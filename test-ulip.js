/**
 * One-shot ULIP diagnostic — run on the server:
 *   node test-ulip.js
 * Logs the full login response and the full 403 body from VAHAN/01.
 */
const axios = require('axios');
require('dotenv').config();

async function run() {
  const loginUrl  = process.env.ULIP_LOGIN_URL;
  const vahanUrl  = process.env.ULIP_VAHAN_DETAILS_URL;
  const username  = process.env.ULIP_USERNAME;
  const password  = process.env.ULIP_PASSWORD;

  console.log('=== ULIP DIAGNOSTIC ===');
  console.log('Login URL :', loginUrl);
  console.log('VAHAN URL :', vahanUrl);
  console.log('Username  :', username);
  console.log('Password  :', password ? `${password.substring(0, 3)}*** (len=${password.length})` : 'MISSING');
  console.log('');

  // ── Step 1: Login ─────────────────────────────────────────────────────────
  console.log('--- [1] LOGIN ---');
  let token;
  try {
    const resp = await axios.post(
      loginUrl,
      { username, password },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('HTTP status    :', resp.status);
    console.log('Full response  :', JSON.stringify(resp.data, null, 2));

    // Try every known path
    const r = resp.data;
    const candidates = {
      'response.id'           : r?.response?.id,
      'response.token'        : r?.response?.token,
      'response.access_token' : r?.response?.access_token,
      'response (raw string)' : typeof r?.response === 'string' ? r?.response : undefined,
      'token'                 : r?.token,
      'access_token'          : r?.access_token,
      'result.access_token'   : r?.result?.access_token,
    };
    console.log('\nToken candidates:');
    for (const [path, val] of Object.entries(candidates)) {
      console.log(`  ${path}: ${val ? `${String(val).substring(0, 40)}... (len=${String(val).length})` : 'undefined'}`);
    }

    token = candidates['response.id'] || candidates['response.token'] ||
            candidates['response.access_token'] || candidates['response (raw string)'] ||
            candidates['token'] || candidates['access_token'] || candidates['result.access_token'];

    if (!token) {
      console.error('\nERROR: Could not extract token from any known path. Stopping.');
      return;
    }
    console.log(`\nUsing token: ${token.substring(0, 40)}... (length=${token.length})`);
  } catch (err) {
    console.error('Login FAILED:', err.response?.status, JSON.stringify(err.response?.data));
    return;
  }

  // ── Step 2: VAHAN/01 ──────────────────────────────────────────────────────
  console.log('\n--- [2] VAHAN/01 ---');
  const testVehicle = 'MH12AB1234'; // placeholder — replace if needed
  const body = { vehiclenumber: testVehicle };
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('Request body    :', JSON.stringify(body));
  console.log('Request headers :', JSON.stringify(headers));

  try {
    const resp = await axios.post(vahanUrl, body, { headers });
    console.log('HTTP status  :', resp.status);
    console.log('Response     :', JSON.stringify(resp.data, null, 2));
  } catch (err) {
    console.log('HTTP status  :', err.response?.status);
    console.log('Error body   :', JSON.stringify(err.response?.data, null, 2));
    console.log('Error headers:', JSON.stringify(err.response?.headers, null, 2));
  }

  // ── Step 3: Same request WITHOUT "Bearer " prefix ─────────────────────────
  console.log('\n--- [3] VAHAN/01 (no "Bearer" prefix) ---');
  try {
    const resp = await axios.post(vahanUrl, body, {
      headers: { 'Authorization': token, 'Content-Type': 'application/json' }
    });
    console.log('HTTP status  :', resp.status);
    console.log('Response     :', JSON.stringify(resp.data, null, 2));
  } catch (err) {
    console.log('HTTP status  :', err.response?.status);
    console.log('Error body   :', JSON.stringify(err.response?.data, null, 2));
  }
}

run().catch(err => console.error('Unhandled:', err.message));
