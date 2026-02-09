const axios = require('axios');
require('dotenv').config();


// In-memory token cache: { [clientID]: { token, expiresAt } }
const tokenCache = {};

async function ulipLogin(clientID) {
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };
  const response = await axios.post(url, payload, { headers });
  const token = response.data.response.id;
  // Store token with 20 hour expiry
  tokenCache[clientID] = {
    token,
    expiresAt: Date.now() + 20 * 60 * 60 * 1000 // 20 hours
  };
  return token;
}

async function getValidToken(clientID) {
  const cached = tokenCache[clientID];
  if (cached && cached.token && cached.expiresAt > Date.now()) {
    return cached.token;
  }
  // No valid token, login
  return await ulipLogin(clientID);
}

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

async function getRTODetails(vehicleNumber, clientID) {
  const token = await getValidToken(clientID);
  const url = process.env.ULIP_VAHAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehiclenumber': vehicleNumber };
  const response = await axios.post(url, data, { headers });
  const xml = response.data.response[0].response;
  // Convert XML to JSON
  let jsonResult;
  await xml2js.parseStringPromise(xml, { explicitArray: false })
    .then(result => { jsonResult = result; })
    .catch(err => { throw new Error('Failed to parse XML response: ' + err.message); });

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
    await existing.update(savePayload);
  } else {
    await VehicleRTOData.create({
      vehicle_number: vehicleNumber,
      client_id: clientID,
      ...savePayload,
      created_at: new Date()
    });
  }

  // Update di_user_vehicle table to mark rto_data as true when data is fetched successfully
  await UserVehicle.update(
    { rto_data: true, updated_at: new Date() },
    { 
      where: { 
        vehicle_number: vehicleNumber,
        client_id: clientID 
      } 
    }
  );

  return jsonResult;
}

module.exports = {
  getRTODetails,
};
