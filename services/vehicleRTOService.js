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
  if (existing) {
    await existing.update({
      rto_data: jsonResult,
      updated_at: new Date()
    });
  } else {
    await VehicleRTOData.create({
      vehicle_number: vehicleNumber,
      client_id: clientID,
      rto_data: jsonResult,
      created_at: new Date(),
      updated_at: new Date()
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
