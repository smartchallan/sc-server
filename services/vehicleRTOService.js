const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  console.log('chkpoint 5');
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };
  
  console.log('chkpoint 5A', url, payload, headers);
  const response = await axios.post(url, payload, { headers });
  console.log('chkpoint 6' , response.data.response.id);
  return response.data.response.id;
}

const xml2js = require('xml2js');

// Import model
const VehicleRTODataModel = require('../models/vehicle_rto_data');
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

async function getRTODetails(vehicleNumber, clientID) {
  console.log('chkpoint 3');
  const token = await ulipLogin();
  const url = process.env.ULIP_VAHAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehiclenumber': vehicleNumber };
  console.log('chkpoint 7', url, data, headers);

  const response = await axios.post(url, data, { headers });
  console.log('chkpoint 7B', response);
  const xml = response.data.response[0].response;
  // Convert XML to JSON
  let jsonResult;
  await xml2js.parseStringPromise(xml, { explicitArray: false })
    .then(result => { jsonResult = result; })
    .catch(err => { throw new Error('Failed to parse XML response: ' + err.message); });
  console.log('chkpoint 8', jsonResult);

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

  return jsonResult;
}

module.exports = {
  getRTODetails,
};
