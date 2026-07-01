const axios = require('axios');
const { Op } = require('sequelize');
const { getValidToken } = require('../utils/ulipTokenManager');
const ULIP_VAHAN_URL = process.env.ULIP_VAHAN_DETAILS_URL || 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0/VAHAN/01';

async function getVehicleByNumber(vehicleNumber) {
  try {

    console.log('hello checkpoint 2', vehicleNumber);
    // Step 1: Get valid token from centralized cache
    const token = await getValidToken();
    if (!token) throw new Error('ULIP login failed, token not received');

    // Step 2: Call VAHAN API with token and vehicle number
    const vahanRes = await axios.post(
      ULIP_VAHAN_URL,
      { vehiclenumber: vehicleNumber },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return vahanRes.data;
  } catch (err) {
    console.error('Error in getVehicleByNumber:', err.message);
    throw err;
  }
}

/**
 * Purge a set of vehicles' RTO + challan data from EVERY table that stores it.
 * Used by all deletion paths (explicit delete, trial expiry, account disable).
 * Call this AFTER the vehicles have been marked 'deleted' so the global-cache
 * guard counts them correctly.
 *
 * @param {object} models
 * @param {object} args - { client_id, vehicleNumbers: string[] }
 */
async function purgeVehicleData(models, { client_id, vehicleNumbers } = {}) {
  const { UserVehicle, VehicleChallan, VehicleRTOData, DiVehicleChallanJob, VehicleReport, UserVehicleRtoData } = models;
  const numbers = [...new Set((vehicleNumbers || []).filter(Boolean))];
  if (numbers.length === 0) return;

  // Client-scoped tables (vehicle_number + client_id).
  const scoped = { client_id, vehicle_number: { [Op.in]: numbers } };
  await Promise.all([
    VehicleChallan.destroy({ where: scoped }),                                            // di_vehicle_challans
    VehicleRTOData.destroy({ where: scoped }),                                            // di_vehicle_rto_data
    DiVehicleChallanJob ? DiVehicleChallanJob.destroy({ where: scoped }) : Promise.resolve(), // di_vehicle_challan_job
    VehicleReport ? VehicleReport.destroy({ where: scoped }) : Promise.resolve(),             // di_vehicle_reports (rto+challan snapshot)
  ]);

  // di_user_vehicle_rto_data is a global per-plate RTO cache (no client_id).
  // Clear a plate only when no non-deleted vehicle still uses it, so we don't
  // wipe RTO data another client is still relying on.
  if (UserVehicleRtoData) {
    for (const vn of numbers) {
      const stillUsed = await UserVehicle.count({
        where: { vehicle_number: vn, status: { [Op.ne]: 'deleted' } }
      });
      if (stillUsed === 0) {
        await UserVehicleRtoData.destroy({ where: { vehicle_number: vn } });
      }
    }
  }
}

async function updateVehicleStatus(models, vehicle_id, status) {
  console.log('Updating vehicle status:', { vehicle_id, status });
  if (!vehicle_id || !status) {
    throw new Error('vehicle_id and status are required.');
  }
  if (!['active', 'delete'].includes(status)) {
    throw new Error('status must be active or delete.');
  }
  const { UserVehicle } = models;
  const vehicle = await UserVehicle.findOne({ where: { id: vehicle_id } });
  if (!vehicle) {
    throw new Error('Vehicle not found.');
  }
  // Convert incoming 'delete' to 'deleted' for DB compatibility
  const dbStatus = status === 'delete' ? 'deleted' : status;

  // Track when the vehicle was deleted (used for the deleted-vehicles drawer and
  // "billable this month"). Clear it again when a vehicle is re-activated.
  const statusFields = { status: dbStatus, deleted_at: dbStatus === 'deleted' ? new Date() : null };
  await vehicle.update(statusFields);

  if (status === 'delete') {
    // Permanent delete: purge this vehicle's RTO + challan data from EVERY table.
    await purgeVehicleData(models, { client_id: vehicle.client_id, vehicleNumbers: [vehicle.vehicle_number] });
    return { message: 'Vehicle deleted and its RTO/challan data cleared from all tables.', vehicle };
  } else {
    return { message: 'Vehicle status updated.', vehicle };
  }
}

module.exports = { getVehicleByNumber, updateVehicleStatus, purgeVehicleData };
