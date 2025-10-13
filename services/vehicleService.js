const axios = require('axios');
const ULIP_LOGIN_URL = process.env.ULIP_LOGIN_URL || 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0/user/login';
const ULIP_VAHAN_URL = process.env.ULIP_VAHAN_URL || 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0/VAHAN/01';

async function getVehicleByNumber(vehicleNumber) {
  try {

    console.log('hello checkpoint 2', vehicleNumber);
    // Step 1: Login to ULIP and get token
    const loginRes = await axios.post(ULIP_LOGIN_URL, {
      // Add required login credentials here
      username: process.env.ULIP_USERNAME || 'mmjn_technoton_usr',
      password: process.env.ULIP_PASSWORD || 'TEch@2025'
    });

    console.log('ulip res', loginRes);
    const token = loginRes.data?.token;
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
  if (!vehicle_id || !status) {
    throw new Error('vehicle_id and status are required.');
  }
  if (!['active', 'inactive', 'delete'].includes(status)) {
    throw new Error('status must be active, inactive, or delete.');
  }
  const { UserVehicle } = models;
  const vehicle = await UserVehicle.findOne({ where: { id: vehicle_id } });
  if (!vehicle) {
    throw new Error('Vehicle not found.');
  }
  // Always update status field, including for delete
  await vehicle.update({ status });
  if (status === 'delete') {
    return { message: 'Vehicle status set to delete.', vehicle };
  } else {
    return { message: 'Vehicle status updated.', vehicle };
  }
}

module.exports = { getVehicleByNumber, updateVehicleStatus};
