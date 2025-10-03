const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };
  const response = await axios.post(url, payload, { headers });
  return response.data.access_token;
}

async function getDriverData(driverId, dob) {
  const token = await ulipLogin();
  const url = process.env.ULIP_DRIVER_DATA_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = {
    "dlnumber": driverId,
    "dob": dob
  }
  const response = await axios.post(url, { data }, { headers });
  console.log('Driver Data Response:', response.data);
  return response.data;
}

module.exports = {
  getDriverData,
};
