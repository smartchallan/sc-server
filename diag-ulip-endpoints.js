/**
 * Compare ULIP VAHAN endpoints with the SAME login token.
 *   node diag-ulip-endpoints.js [VEHICLE_NUMBER]
 *
 * Tells us whether the account is authorized for VAHAN/01 (old) vs VAHAN/04
 * (new). An empty-body 403 = access denied at the gateway (not quota).
 */
require('dotenv').config();
const axios = require('axios');

const BASE = 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0';
const vehicle = (process.argv[2] || 'CG04MP2477').toUpperCase().trim();

async function login() {
  const r = await axios.post(process.env.ULIP_LOGIN_URL, {
    username: process.env.ULIP_USERNAME,
    password: process.env.ULIP_PASSWORD,
  }, { headers: { 'Content-Type': 'application/json' } });
  const raw = r.data?.response;
  const token = (typeof raw === 'string') ? raw : (raw?.id ?? raw?.token ?? raw?.access_token);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  console.log('Login OK. token apps =', payload.apps, '| sub =', payload.sub, '\n');
  return token;
}

async function hit(label, url, token) {
  try {
    const r = await axios.post(url, { vehiclenumber: vehicle }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const inner = r.data?.response?.[0]?.response;
    const kind = inner == null ? 'null (not-found/error)' : (typeof inner === 'string' ? 'XML string' : 'JSON object');
    console.log(`✅ ${label}: HTTP ${r.status} | payload = ${kind} | outer code=${r.data?.code}`);
  } catch (err) {
    const s = err.response?.status;
    const body = err.response?.data;
    const len = err.response?.headers?.['content-length'];
    console.log(`❌ ${label}: HTTP ${s} | body(len ${len ?? '?'}) = ${JSON.stringify(body) || '""'}`);
  }
}

(async () => {
  console.log(`\nVehicle: ${vehicle}\n`);
  const token = await login();
  await hit('VAHAN/01 (XML, datapush)', `${BASE}/VAHAN/01`, token);
  await hit('VAHAN/04 (JSON, apiGateway)', `${BASE}/VAHAN/04`, token);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
