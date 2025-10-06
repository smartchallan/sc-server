const axios = require('axios');
require('dotenv').config();

async function ulipLogin() {
  // console.log('chkpoint 5');
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };
  
  // console.log('chkpoint 5A', url, payload, headers);
  const response = await axios.post(url, payload, { headers });
  // console.log('chkpoint 6' , response.data.response.id);
  return response.data.response.id;
}

async function getChallanDetails(vehicleNumber) {
  console.log('chkpoint 3');
  const token = await ulipLogin();
  const url = process.env.ULIP_ECHALLAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehicleNumber': vehicleNumber };
  console.log('chkpoint 7', url, data, headers);

  const response = await axios.post(url, data, { headers });
  console.log('vehicle challan data pending', response.data.response[0].response.data.Pending_data);
  console.log('vehicle challan data disposed', response.data.response[0].response.data.Disposed_data);
  return response.data.response[0].response.data;
}

module.exports = {
  getChallanDetails,
};
