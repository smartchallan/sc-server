const axios = require('axios');

const ULIP_LOGIN_URL = process.env.ULIP_LOGIN_URL || 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/user/login';
const ULIP_VAHAN_URL = process.env.ULIP_VAHAN_URL || 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/VAHAN/01';

async function getVehicleByNumber(vehicleNumber) {
  try {

    console.log('hello checkpoint 2', vehicleNumber);
    // Step 1: Login to ULIP and get token
    const loginRes = await axios.post(ULIP_LOGIN_URL, {
      // Add required login credentials here
      username: process.env.ULIP_USERNAME,
      password: process.env.ULIP_PASSWORD
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

module.exports = { getVehicleByNumber };
