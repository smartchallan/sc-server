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

  const url = process.env.ULIP_VAHAN_DETAILS_URL;
  console.log(`[getRTODetails] Calling ULIP URL: ${url}`);

  const response = await callUlipWithRetry(url, { vehiclenumber: vehicleNumber });
  console.log(`[getRTODetails] ULIP HTTP status: ${response.status}`);
  console.log(`[getRTODetails] ULIP raw response:`, JSON.stringify(response.data));

  // Guard: validate ULIP response structure before accessing nested path
  if (
    !response.data ||
    !Array.isArray(response.data.response) ||
    response.data.response.length === 0 ||
    !response.data.response[0] ||
    !response.data.response[0].response
  ) {
    throw new Error(
      `ULIP returned unexpected structure for ${vehicleNumber}. ` +
      `Full response: ${JSON.stringify(response.data)}`
    );
  }

  const xml = response.data.response[0].response;
  console.log(`[getRTODetails] XML extracted (first 200 chars): ${String(xml).substring(0, 200)}`);

  // Convert XML to JSON
  let jsonResult;
  await xml2js.parseStringPromise(xml, { explicitArray: false })
    .then(result => { jsonResult = result; })
    .catch(err => { throw new Error('Failed to parse XML response: ' + err.message); });

  console.log(`[getRTODetails] XML parsed successfully`);

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
