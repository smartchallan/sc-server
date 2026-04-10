const axios = require('axios');
require('dotenv').config();

// Centralized token cache (single token for all clients)
let tokenCache = {
  token: null,
  expiresAt: 0
};

// Ensures only one concurrent login is in flight at a time
let loginPromise = null;

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

  // Log the FULL login response so we can see exactly what ULIP returns
  console.log('[ulipLogin] HTTP status:', response.status);
  console.log('[ulipLogin] FULL response.data:', JSON.stringify(response.data));

  // ULIP v1 returns token as a plain string in response.data.response
  // Older/alternate format returns it in response.data.response.id
  const raw = response.data?.response;
  let token;
  if (typeof raw === 'string' && raw.length > 10) {
    token = raw;
  } else if (raw && typeof raw === 'object') {
    token = raw.id ?? raw.token ?? raw.access_token;
  } else {
    token = response.data?.token ?? response.data?.access_token ?? response.data?.id;
  }

  if (!token || typeof token !== 'string' || token.length < 10) {
    console.error('[ulipLogin] FAILED to extract token. Full response.data:', JSON.stringify(response.data));
    throw new Error(`ULIP login returned no usable token. Full body: ${JSON.stringify(response.data)}`);
  }

  console.log('[ulipLogin] Token OK, length:', token.length, 'first 30 chars:', token.substring(0, 30));

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
 * Get a valid ULIP token (from cache or by logging in).
 * Concurrent callers share a single in-flight login promise so that only
 * one login request is made even when multiple requests fire simultaneously.
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

  // If a login is already in flight, wait for it instead of starting another
  if (loginPromise) {
    console.table({ action: 'Token Expired or Missing', status: 'Waiting for in-flight login' });
    return loginPromise;
  }

  // No valid token and no login in progress — start one
  console.table({ action: 'Token Expired or Missing', status: 'Fetching new token' });
  loginPromise = ulipLogin().finally(() => { loginPromise = null; });
  return loginPromise;
}

/**
 * Force refresh the token (useful when a 401 is received).
 * Invalidates the cache so the next getValidToken() call triggers a new login.
 * @returns {Promise<string>} New authentication token
 */
async function refreshToken() {
  console.table({ action: 'Force Token Refresh', reason: 'Token rejected by server' });
  // Invalidate cache so getValidToken() triggers a fresh login
  tokenCache = { token: null, expiresAt: 0 };
  return getValidToken();
}

module.exports = {
  getValidToken,
  refreshToken
};
