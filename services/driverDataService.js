const axios = require('axios');
require('dotenv').config();
const { getValidToken } = require('../utils/ulipTokenManager');

async function getDriverData(driverId, dob) {
  const token = await getValidToken();
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
  
  try {
    const response = await axios.post(url, data, { headers });
    console.log('Driver Data Response Status:', response.status);
    console.log('Driver Data Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Driver API Error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
  return response.data;
}

module.exports = {
  getDriverData,
};
