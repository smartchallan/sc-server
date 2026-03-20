const axios = require('axios');
require('dotenv').config();
const { getValidToken, refreshToken } = require('../utils/ulipTokenManager');

async function getFastagData(vehiclenumber) {
  let token = await getValidToken();
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
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.table({ action: 'ULIP 401 — forcing token refresh (fastag)', url });
      token = await refreshToken();
      headers['Authorization'] = `Bearer ${token}`;
      const retryResponse = await axios.post(url, data, { headers });
      return retryResponse.data;
    }
    console.error('Fastag API Error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getFastagData,
};
