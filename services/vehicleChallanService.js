const axios = require('axios');
require('dotenv').config();
const { getValidToken, refreshToken } = require('../utils/ulipTokenManager');

// Import models
const VehicleChallanModel = require('../models/vehicle_challan');
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
const VehicleChallan = VehicleChallanModel(sequelize);
const UserVehicle = UserVehicleModel(sequelize);


async function getChallanDetails(vehicleNumber, clientID) {
  console.log('chkpoint 3');
  let token = await getValidToken();
  const url = process.env.ULIP_ECHALLAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehicleNumber': vehicleNumber };
  console.log('chkpoint 7', url, data, headers);

  let response;
  try {
    response = await axios.post(url, data, { headers });
  } catch (err) {
    // If error is invalid token, refresh token and retry once
    if (err.response && err.response.data &&
        (String(err.response.data.message || '').toLowerCase().includes('invalid token') ||
         String(err.response.data.error || '').toLowerCase().includes('invalid token'))
    ) {
      token = await refreshToken(); // force refresh
      headers['Authorization'] = `Bearer ${token}`;
      response = await axios.post(url, data, { headers });
    } else {
      throw err;
    }
  }

  const pendingData = response.data.response[0].response.data?.Pending_data;
  const disposedData = response.data.response[0].response.data?.Disposed_data;
  // Check if both pending and disposed data are empty or null
  const hasPendingChallans = pendingData && (Array.isArray(pendingData) ? pendingData.length > 0 : pendingData);
  const hasDisposedChallans = disposedData && (Array.isArray(disposedData) ? disposedData.length > 0 : disposedData);
  if (!hasPendingChallans && !hasDisposedChallans) {
    // Update di_user_vehicle table to mark challan_data as true even when no challans found
    await UserVehicle.update(
      { challan_data: true, updated_at: new Date() },
      { 
        where: { 
          vehicle_number: vehicleNumber,
          client_id: clientID 
        } 
      }
    );
    // Return success message when no challans are found
    return {
      success: true,
      message: 'Vehicle has no challan issued',
      data: {
        Pending_data: null,
        Disposed_data: null
      }
    };
  }
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
  // Update di_user_vehicle table to mark challan_data as true when data is fetched successfully
  await UserVehicle.update(
    { challan_data: true, updated_at: new Date() },
    { 
      where: { 
        vehicle_number: vehicleNumber,
        client_id: clientID 
      } 
    }
  );
  console.log('vehicle challan data pending', pendingData);
  console.log('vehicle challan data disposed', disposedData);
  return response.data.response[0].response.data;
}

module.exports = {
  getChallanDetails,
};
