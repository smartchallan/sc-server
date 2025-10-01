const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  console.log('chkpoint 5');
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

async function getChallanDetails(vehicleNumber) {
  console.log('chkpoint 3');
  const token = await ulipLogin();
  const url = process.env.ULIP_CHALLAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const response = await axios.post(url, { vehicleNumber }, { headers });
  return response.data;
}

module.exports = {
  getChallanDetails,
};
