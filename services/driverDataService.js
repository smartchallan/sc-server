const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
    client_id: process.env.ULIP_CLIENT_ID,
    client_secret: process.env.ULIP_CLIENT_SECRET,
    grant_type: 'password',
  };
  const headers = { 'Content-Type': 'application/json' };
  const response = await axios.post(url, payload, { headers });
  return response.data.access_token;
}

async function getDriverData(driverId) {
  const token = await ulipLogin();
  const url = process.env.ULIP_DRIVER_DATA_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const response = await axios.post(url, { driverId }, { headers });
  return response.data;
}

module.exports = {
  getDriverData,
};
