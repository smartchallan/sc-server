const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  // console.log('chkpoint 5');
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };
  
  // console.log('chkpoint 5A', url, payload, headers);
  const response = await axios.post(url, payload, { headers });
  // console.log('chkpoint 6' , response.data.response.id);
  return response.data.response.id;
}

// Import model
const VehicleChallanModel = require('../models/vehicle_challan');
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
const VehicleChallan = VehicleChallanModel(sequelize);

async function getChallanDetails(vehicleNumber, clientID) {
  console.log('chkpoint 3');
  const token = await ulipLogin();
  const url = process.env.ULIP_ECHALLAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehicleNumber': vehicleNumber };
  console.log('chkpoint 7', url, data, headers);

  const response = await axios.post(url, data, { headers });
  console.log('chkpoint 7A', response.data.response[0].response.data);
  const pendingData = response.data.response[0].response.data?.Pending_data;
  const disposedData = response.data.response[0].response.data?.Disposed_data;
  // Save to di_vehicle_challans
  const existing = await VehicleChallan.findOne({
    where: { client_id: clientID, vehicle_number: vehicleNumber }
  });
  if (existing) {
    await existing.update({
      pending_data: pendingData,
      disposed_data: disposedData,
      updated_at: new Date()
    });
  } else {
    await VehicleChallan.create({
      client_id: clientID,
      vehicle_number: vehicleNumber,
      pending_data: pendingData,
      disposed_data: disposedData,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  console.log('vehicle challan data pending', pendingData);
  console.log('vehicle challan data disposed', disposedData);
  return response.data.response[0].response.data;
}

module.exports = {
  getChallanDetails,
};
