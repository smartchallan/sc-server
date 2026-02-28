const axios = require('axios');
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

async function updateVehicleStatus(models, vehicle_id, status) {
  console.log('Updating vehicle status:', { vehicle_id, status });
  if (!vehicle_id || !status) {
    throw new Error('vehicle_id and status are required.');
  }
  if (!['active', 'inactive', 'delete'].includes(status)) {
    throw new Error('status must be active, inactive, or delete.');
  }
  const { UserVehicle, VehicleChallan, VehicleRTOData } = models;
  const vehicle = await UserVehicle.findOne({ where: { id: vehicle_id } });
  if (!vehicle) {
    throw new Error('Vehicle not found.');
  }
  // Convert incoming 'delete' to 'deleted' for DB compatibility
  const dbStatus = status === 'delete' ? 'deleted' : status;

  // Always update status field
  await vehicle.update({ status: dbStatus });

  if (status === 'delete') {
    // Clear RTO and challan data for this vehicle and client
    const vehicle_number = vehicle.vehicle_number;
    const client_id = vehicle.client_id;
    await VehicleChallan.destroy({
      where: { vehicle_number, client_id }
    });
    await VehicleRTOData.destroy({
      where: { vehicle_number, client_id }
    });
    return { message: 'Vehicle status set to deleted and RTO/challan data cleared.', vehicle };
  } else {
    return { message: 'Vehicle status updated.', vehicle };
  }
}

module.exports = { getVehicleByNumber, updateVehicleStatus};
