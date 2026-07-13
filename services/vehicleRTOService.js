const axios = require('axios');
require('dotenv').config();
const { getValidToken, refreshToken } = require('../utils/ulipTokenManager');
const { acquireSlot } = require('../utils/ulipRateLimiter');

const xml2js = require('xml2js');

// Import models
const VehicleRTODataModel = require('../models/vehicle_rto_data');
const UserVehicleModel = require('../models/userVehicle');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(
  process.env.PG_DATABASE,
  process.env.PG_USER,
  process.env.PG_PASSWORD,
  {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    dialect: 'mysql',
    logging: false,
    dialectOptions: process.env.PG_SSL === 'false' ? {
      ssl: {
        require: false,
        rejectUnauthorized: false,
      }
    } : {},
  }
);
const VehicleRTOData = VehicleRTODataModel(sequelize);
const UserVehicle = UserVehicleModel(sequelize);

// ── VAHAN/04 JSON → legacy VehicleDetails (snake_case) normalization ───────────
// VAHAN/01 returned XML which xml2js parsed into snake_case keys under
// <VehicleDetails> (e.g. rc_regn_no, rc_owner_name, state_cd). VAHAN/04 returns
// the same data as a JSON object with camelCase keys (rcRegnNo, rcOwnerName,
// stateCd). To keep the stored contract identical for every downstream consumer
// (dashboard tables, vehicle report, exports), we convert VAHAN/04 back into the
// snake_case shape while ALSO keeping the original camelCase keys, so nothing
// that reads either style can break.
function camelToSnake(str) {
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function deepConvertKeys(input) {
  if (Array.isArray(input)) return input.map(deepConvertKeys);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[camelToSnake(k)] = deepConvertKeys(v);
    }
    return out;
  }
  return input;
}

// Build a VehicleDetails object that carries BOTH snake_case (legacy/XML style)
// and the original camelCase keys. `stautsMessage` (note the source's spelling)
// is preserved verbatim because clients read it directly.
function mapVahan04ToVehicleDetails(obj) {
  const snake = deepConvertKeys(obj);
  return { ...snake, ...obj };
}

async function callUlipWithRetry(url, data) {
  const makeRequest = async (token) => axios.post(url, data, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  // Acquire a rate-limit slot before hitting the ULIP API
  await acquireSlot();

  let token = await getValidToken();
  try {
    return await makeRequest(token);
  } catch (err) {
    const status = err.response?.status;
    const errBody = err.response?.data;
    const errMsg = errBody?.message || '';

    // Daily quota exhausted — no point retrying or refreshing the token
    if (status === 403 && errMsg.toLowerCase().includes('daily usage limit')) {
      const quotaErr = new Error(`ULIP daily quota reached for ${url}. ${errMsg}`);
      quotaErr.code = 'ULIP_QUOTA_EXCEEDED';
      quotaErr.ulipMessage = errMsg;
      throw quotaErr;
    }

    // Token rejected — force a fresh login and retry once
    if (status === 401 || status === 403) {
      console.table({ action: `ULIP ${status} — forcing token refresh`, url });
      token = await refreshToken();
      return await makeRequest(token);
    }

    throw err;
  }
}

async function getRTODetails(vehicleNumber, clientID) {
  console.log(`[getRTODetails] START vehicleNumber=${vehicleNumber} clientID=${clientID}`);

  // VAHAN/04 returns JSON (VAHAN/01 returned XML). Default to VAHAN/04.
  const url = process.env.ULIP_VAHAN_DETAILS_URL || 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0/VAHAN/04';
  console.log(`[getRTODetails] Calling ULIP URL: ${url}`);

  const response = await callUlipWithRetry(url, { vehiclenumber: vehicleNumber });
  console.log(`[getRTODetails] ULIP HTTP status: ${response.status}`);
  console.log(`[getRTODetails] ULIP raw response:`, JSON.stringify(response.data));

  // Guard: validate the ULIP response wrapper before accessing the nested payload
  if (
    !response.data ||
    !Array.isArray(response.data.response) ||
    response.data.response.length === 0 ||
    !response.data.response[0]
  ) {
    throw new Error(
      `ULIP returned unexpected structure for ${vehicleNumber}. ` +
      `Full response: ${JSON.stringify(response.data)}`
    );
  }

  const inner = response.data.response[0];
  const payload = inner.response;

  // Normalize every VAHAN variant into the same { VehicleDetails: {...} } shape:
  //  • VAHAN/04 success  → payload is a JSON object (camelCase)  → normalize to snake_case
  //  • VAHAN/01/02/03    → payload is an XML string              → parse via xml2js (kept for fallback)
  //  • Vehicle not found → payload is null + responseStatus ERROR → minimal not-found record
  let jsonResult;
  if (payload && typeof payload === 'object') {
    jsonResult = { VehicleDetails: mapVahan04ToVehicleDetails(payload) };
    console.log(`[getRTODetails] VAHAN/04 JSON normalized to VehicleDetails`);
  } else if (typeof payload === 'string' && payload.trim()) {
    console.log(`[getRTODetails] XML extracted (first 200 chars): ${payload.substring(0, 200)}`);
    await xml2js.parseStringPromise(payload, { explicitArray: false })
      .then(result => { jsonResult = result; })
      .catch(err => { throw new Error('Failed to parse XML response: ' + err.message); });
    console.log(`[getRTODetails] XML parsed successfully`);
  } else {
    // Vehicle not present in VAHAN — save a minimal record (matches legacy behaviour)
    const notFound = (inner.message && (inner.message.text || inner.message)) || 'Vehicle Data Not Found';
    jsonResult = { VehicleDetails: { stautsMessage: typeof notFound === 'string' ? notFound : 'Vehicle Data Not Found' } };
    console.log(`[getRTODetails] Vehicle not found for ${vehicleNumber}: ${jsonResult.VehicleDetails.stautsMessage}`);
  }

  // Save to di_vehicle_rto_data
  const existing = await VehicleRTOData.findOne({
    where: { vehicle_number: vehicleNumber, client_id: clientID }
  });

  // Normalize date strings to YYYY-MM-DD for DATEONLY columns
  const moment = require('moment');
  const normalizeDate = (val) => {
    if (!val && val !== 0) return null;
    // Handle moment-like objects returned from some parsers
    if (typeof val === 'object' && val !== null) {
      if (val._isAMomentObject && typeof val.format === 'function') {
        try { return val.format('YYYY-MM-DD'); } catch (e) { return null; }
      }
      // If the object contains an original input string, try that
      if (val._i) {
        val = val._i;
      } else {
        return null;
      }
    }

    const s = String(val).trim();
    if (!s) return null;
    // If value has no digits, treat as non-date (e.g. 'LTT')
    if (!/[0-9]/.test(s)) return null;

    // Common formats seen in RTO responses: 26-Jun-2026, 24-Oct-2027, 2026-06-26, etc.
    const formats = ['DD-MMM-YYYY','DD-MMM-YY','DD-MM-YYYY','YYYY-MM-DD','DD/MM/YYYY'];
    let m = moment(s, formats, true);
    if (!m.isValid()) m = moment(s, moment.ISO_8601, true);
    if (!m.isValid()) return null;
    return m.format('YYYY-MM-DD');
  };

  // Attempt to locate VehicleDetails object robustly
  const vd = (jsonResult && (jsonResult.VehicleDetails || jsonResult.vehicleDetails || jsonResult.vehicledetails)) || jsonResult || {};
  const insurance_exp_val = normalizeDate(vd.rc_insurance_upto || vd.rc_insurance_upto_date || vd.rc_insurance_upto);
  const fitness_exp_val = normalizeDate(vd.rc_fit_upto || vd.rc_fit_upto_date || vd.rc_fit_upto);
  const pollution_exp_val = normalizeDate(vd.rc_pucc_upto || vd.rc_pucc_upto_date || vd.rc_pucc_upto);
  const road_tax_exp_val = normalizeDate(vd.rc_tax_upto || vd.rc_tax_upto_date || vd.rc_tax_upto);

  const savePayload = {
    rto_data: jsonResult,
    insurance_exp: insurance_exp_val,
    road_tax_exp: road_tax_exp_val,
    fitness_exp: fitness_exp_val,
    pollution_exp: pollution_exp_val,
    updated_at: new Date()
  };

  if (existing) {
    console.log(`[getRTODetails] Updating existing DB record for ${vehicleNumber}`);
    await existing.update(savePayload);
  } else {
    console.log(`[getRTODetails] Creating new DB record for ${vehicleNumber}`);
    await VehicleRTOData.create({
      vehicle_number: vehicleNumber,
      client_id: clientID,
      ...savePayload,
      created_at: new Date()
    });
  }
  console.log(`[getRTODetails] DB save complete for ${vehicleNumber}`);

  // Update di_user_vehicle table to mark rto_data as true when data is fetched successfully
  await UserVehicle.update(
    { rto_data: true, updated_at: new Date() },
    { where: { vehicle_number: vehicleNumber, client_id: clientID } }
  );
  console.log(`[getRTODetails] UserVehicle rto_data flag updated for ${vehicleNumber}`);

  return jsonResult;
}

module.exports = {
  getRTODetails,
};
