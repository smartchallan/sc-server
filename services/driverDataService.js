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
  console.log('chkpoint 6' , response.data.response.id);
  return response.data.response.id;
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
  console.log('Driver call:', url, data, headers);
  const response = await axios.post(url, { data }, { headers });
  console.log('Driver Data Response:', response);
  return response.data;
}

module.exports = {
  getDriverData,
};
