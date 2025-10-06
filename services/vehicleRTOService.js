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
  
  console.log('chkpoint 5A', url, payload, headers);
  const response = await axios.post(url, payload, { headers });
  console.log('chkpoint 6' , response.data.response.id);
  return response.data.response.id;
}

const xml2js = require('xml2js');

async function getRTODetails(vehicleNumber, clientID) {
  console.log('chkpoint 3');
  const token = await ulipLogin();
  const url = process.env.ULIP_VAHAN_DETAILS_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { 'vehiclenumber': vehicleNumber };
  console.log('chkpoint 7', url, data, headers);

  const response = await axios.post(url, data, { headers });
  const xml = response.data.response[0].response;
  // Convert XML to JSON
  let jsonResult;
  await xml2js.parseStringPromise(xml, { explicitArray: false })
    .then(result => { jsonResult = result; })
    .catch(err => { throw new Error('Failed to parse XML response: ' + err.message); });
  console.log('chkpoint 8', jsonResult);
  return jsonResult;
}

module.exports = {
  getRTODetails,
};
