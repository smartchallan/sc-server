const axios = require('axios');
require('dotenv').config();
const { getValidToken, refreshToken } = require('../utils/ulipTokenManager');

async function getDriverData(driverId, dob) {
  let token = await getValidToken();
  const url = process.env.ULIP_DRIVER_DATA_URL;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = { dlnumber: driverId, dob };
  console.log('Driver call:', url, data, headers);

  try {
    const response = await axios.post(url, data, { headers });
    console.log('Driver Data Response Status:', response.status);
    console.log('Driver Data Response (full):', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.table({ action: 'ULIP 401 — forcing token refresh (driver)', url });
      token = await refreshToken();
      headers['Authorization'] = `Bearer ${token}`;
      const retryResponse = await axios.post(url, data, { headers });
      return retryResponse.data;
    }
    console.error('Driver API Error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getDriverData,
};
