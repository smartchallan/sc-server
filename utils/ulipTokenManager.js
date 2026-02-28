const axios = require('axios');
require('dotenv').config();

// Centralized token cache (single token for all clients)
let tokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * Login to ULIP and get authentication token
 * @returns {Promise<string>} Authentication token
 */
async function ulipLogin() {
  const url = process.env.ULIP_LOGIN_URL;
  const payload = {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  };
  const headers = { 'Content-Type': 'application/json' };
  
  console.table({ action: 'ULIP Login', url, username: payload.username });
  
  const response = await axios.post(url, payload, { headers });
  const token = response.data.response.id;
  
  // Store token with 20 hour expiry
  tokenCache = {
    token,
    expiresAt: Date.now() + 20 * 60 * 60 * 1000 // 20 hours
  };
  
  console.table({ 
    action: 'Token Cached', 
    expiresAt: new Date(tokenCache.expiresAt).toISOString(),
    validFor: '20 hours' 
  });
  
  return token;
}

/**
 * Get a valid ULIP token (from cache or by logging in)
 * @returns {Promise<string>} Valid authentication token
 */
async function getValidToken() {
  // Check if cached token is still valid
  if (tokenCache.token && tokenCache.expiresAt > Date.now()) {
    const remainingHours = ((tokenCache.expiresAt - Date.now()) / (60 * 60 * 1000)).toFixed(2);
    console.table({ 
      action: 'Using Cached Token', 
      remainingHours: `${remainingHours}h` 
    });
    return tokenCache.token;
  }
  
  // No valid token, login to get new one
  console.table({ action: 'Token Expired or Missing', status: 'Fetching new token' });
  return await ulipLogin();
}

/**
 * Force refresh the token (useful when token is invalid)
 * @returns {Promise<string>} New authentication token
 */
async function refreshToken() {
  console.table({ action: 'Force Token Refresh', reason: 'Manual refresh requested' });
  return await ulipLogin();
}

module.exports = {
  getValidToken,
  refreshToken
};
