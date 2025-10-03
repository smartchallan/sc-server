const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  console.log('chkpoint 5');
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

async function getChallanDetails(vehicleNumber) {
  console.log('chkpoint 3');
  const token = await ulipLogin();
  const url = process.env.ULIP_CHALLAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehiclenumber': vehicleNumber };
  console.log('chkpoint 7', url, data, headers);

  const response = await axios.post(url, data, { headers });
  console.log('chkpoint 8', response.data.response);
  return response;
}

module.exports = {
  getChallanDetails,
};
