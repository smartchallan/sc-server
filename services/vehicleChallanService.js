const axios = require('axios');
require('dotenv').config();
const moment = require('moment');
const { getValidToken, refreshToken } = require('../utils/ulipTokenManager');

/** Normalize a date string to DD-MMM-YYYY, returns null if unparseable */
function normalizeDate(val) {
  if (!val) return null;
  const formats = ['DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD'];
  let m = moment(val, formats, true);
  if (!m.isValid()) m = moment(val); // ISO / other fallback
  return m.isValid() ? m.format('DD-MMM-YYYY') : null;
}

/** Normalize date fields in an array of challan objects in-place */
function normalizeChallanDates(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    if (copy.challan_date_time) copy.challan_date_time = normalizeDate(copy.challan_date_time) || copy.challan_date_time;
    if (copy.hearing_date) copy.hearing_date = normalizeDate(copy.hearing_date) || copy.hearing_date;
    if (copy.payment_date) copy.payment_date = normalizeDate(copy.payment_date) || copy.payment_date;
    return copy;
  });
}

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
    const status = err.response?.status;
    const bodyText = JSON.stringify(err.response?.data || '').toLowerCase();
    // Retry on HTTP 401 OR body containing "invalid token"
    if (status === 401 || bodyText.includes('invalid token')) {
      console.table({ action: 'ULIP 401/invalid-token — forcing token refresh', url });
      token = await refreshToken();
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
  const rawData = response.data.response[0].response.data;
  return {
    ...rawData,
    Pending_data: normalizeChallanDates(rawData.Pending_data),
    Disposed_data: normalizeChallanDates(rawData.Disposed_data),
  };
}

module.exports = {
  getChallanDetails,
};
