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

async function getFastagData(vehiclenumber) {
  const token = await ulipLogin();
  const url = process.env.ULIP_FASTAG_DATA_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
    const data = { 'vehiclenumber': vehiclenumber };
    console.log('chkpoint 7', url, data, headers);
  
    try {
      const response = await axios.post(url, data, { headers });
      console.log('Fastag Response Status:', response.status);
      console.log('chkpoint 8', response.data.response[0].response);
      return response;
    } catch (error) {
      console.error('Fastag API Error:', error.response?.status, error.response?.data || error.message);
      throw error;
    }
}

module.exports = {
  getFastagData,
};
