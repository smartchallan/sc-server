const axios = require('axios');
require('dotenv').config();
const moment = require('moment');
const { getValidToken, refreshToken } = require('../utils/ulipTokenManager');
const { acquireSlot } = require('../utils/ulipRateLimiter');

/** Normalize a date string to DD-MMM-YYYY, returns null if unparseable */
function normalizeDate(val) {
  if (!val) return null;
  const formats = ['DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD'];
  let m = moment(val, formats, true);
  if (!m.isValid()) m = moment(val); // ISO / other fallback
  return m.isValid() ? m.format('DD-MMM-YYYY') : null;
}

/** Extract a challan's identifier, tolerating both ULIP field spellings. */
function challanNoOf(c) {
  return c && (c.challan_no || c.challan_number);
}

/**
 * Diff the previously-stored pending challans against this run's ULIP data.
 * Any old pending challan whose number is absent from the fresh pending+disposed
 * set is treated as cancelled at source. Previously-cancelled challans are kept
 * cancelled unless they reappear (then they drop out and are active again).
 * Returns a de-duplicated array of challan objects tagged challan_status:'Cancelled'.
 */
function computeCancelledData(prevPending, prevCancelled, freshPending, freshDisposed) {
  const freshSet = new Set();
  [...(freshPending || []), ...(freshDisposed || [])].forEach((c) => {
    const n = challanNoOf(c);
    if (n) freshSet.add(String(n));
  });
  const byNo = new Map();
  // Keep prior cancellations that are still absent from ULIP.
  (prevCancelled || []).forEach((c) => {
    const n = challanNoOf(c);
    if (n && !freshSet.has(String(n))) byNo.set(String(n), { ...c, challan_status: 'Cancelled' });
  });
  // Newly cancelled: previously pending, now missing from ULIP.
  (prevPending || []).forEach((c) => {
    const n = challanNoOf(c);
    if (n && !freshSet.has(String(n)) && !byNo.has(String(n))) {
      byNo.set(String(n), { ...c, challan_status: 'Cancelled', cancelled_at: new Date().toISOString() });
    }
  });
  return Array.from(byNo.values());
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

  // Acquire a rate-limit slot before hitting the ULIP API
  await acquireSlot();

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

  const pendingArr = Array.isArray(pendingData) ? pendingData : [];
  const disposedArr = Array.isArray(disposedData) ? disposedData : [];

  // Load the stored row up-front so we can diff the previously-pending challans
  // against this run and detect cancellations (challans that were pending before
  // but ULIP no longer returns them).
  const existing = await VehicleChallan.findOne({
    where: { client_id: clientID, vehicle_number: vehicleNumber }
  });
  const prevPending = existing && Array.isArray(existing.pending_data) ? existing.pending_data : [];
  const prevCancelled = existing && Array.isArray(existing.cancelled_data) ? existing.cancelled_data : [];
  const cancelledData = computeCancelledData(prevPending, prevCancelled, pendingArr, disposedArr);

  if (!hasPendingChallans && !hasDisposedChallans) {
    // ULIP returned no active challans. Any previously-pending challans are now
    // cancelled; clear pending, keep disposed history, persist cancellations.
    if (existing) {
      await existing.update({
        pending_data: [],
        cancelled_data: cancelledData,
        updated_at: new Date()
      });
    }
    // Update di_user_vehicle table to mark challan_data as true even when no challans found
    await UserVehicle.update(
      { challan_data: true, updated_at: new Date() },
      { where: { vehicle_number: vehicleNumber, client_id: clientID } }
    );
    return {
      success: true,
      message: cancelledData.length ? 'Pending challans cancelled; no active challans' : 'Vehicle has no challan issued',
      data: {
        Pending_data: null,
        Disposed_data: null,
        Cancelled_data: normalizeChallanDates(cancelledData)
      }
    };
  }
  // Save to di_vehicle_challans
  if (existing) {
    await existing.update({
      pending_data: pendingArr,
      disposed_data: disposedArr,
      cancelled_data: cancelledData,
      updated_at: new Date()
    });
  } else {
    await VehicleChallan.create({
      client_id: clientID,
      vehicle_number: vehicleNumber,
      pending_data: pendingArr,
      disposed_data: disposedArr,
      cancelled_data: cancelledData,
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
  console.log('vehicle challan data pending', pendingArr.length, 'disposed', disposedArr.length, 'cancelled', cancelledData.length);
  const rawData = response.data.response[0].response.data;
  return {
    ...rawData,
    Pending_data: normalizeChallanDates(rawData.Pending_data),
    Disposed_data: normalizeChallanDates(rawData.Disposed_data),
    Cancelled_data: normalizeChallanDates(cancelledData),
  };
}

module.exports = {
  getChallanDetails,
};
