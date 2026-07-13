/**
 * Diagnose why a vehicle still shows pending challans after the cancellation
 * feature. Run on the server (needs DB + ULIP creds in .env):
 *
 *   node diagnose-challan.js CG13BD9922            # auto-detects client_id
 *   node diagnose-challan.js CG13BD9922 123        # explicit client_id
 *   node diagnose-challan.js CG13BD9922 123 --run  # also re-fetch + apply cancellation
 *
 * Without --run it is read-only: prints the stored row + the raw ULIP envelope so
 * you can see exactly what ULIP returns (and whether the "no challan" shape is
 * being parsed correctly). With --run it calls getChallanDetails and shows the
 * before/after stored row.
 */
require('dotenv').config();
const { sequelize, UserVehicle, VehicleChallan } = require('./models');

const vehicleNumber = (process.argv[2] || '').trim();
const clientArg = process.argv[3] && !process.argv[3].startsWith('--') ? Number(process.argv[3]) : null;
const doRun = process.argv.includes('--run');

const nums = (arr) => (Array.isArray(arr) ? arr.map((c) => c && (c.challan_no || c.challan_number)).filter(Boolean) : []);
const dumpRow = (row, label) => {
  if (!row) { console.log(`  (${label}) no di_vehicle_challans row`); return; }
  const j = row.toJSON ? row.toJSON() : row;
  console.log(`  (${label}) client_id=${j.client_id}`);
  console.log(`     pending  (${nums(j.pending_data).length}):`, nums(j.pending_data).join(', ') || '—');
  console.log(`     disposed (${nums(j.disposed_data).length}):`, nums(j.disposed_data).join(', ') || '—');
  console.log(`     cancelled(${nums(j.cancelled_data).length}):`, nums(j.cancelled_data).join(', ') || '—');
};

(async () => {
  if (!vehicleNumber) { console.error('Usage: node diagnose-challan.js <VEHICLE_NUMBER> [clientId] [--run]'); process.exit(1); }
  try {
    await sequelize.authenticate();

    // 1) Which client(s) own this vehicle?
    const vehicles = await UserVehicle.findAll({ where: { vehicle_number: vehicleNumber }, attributes: ['id', 'client_id', 'status'], raw: true });
    console.log(`\n=== di_user_vehicle rows for ${vehicleNumber} ===`);
    console.table(vehicles);
    const clientId = clientArg || (vehicles[0] && vehicles[0].client_id);
    if (!clientId) { console.error('Could not determine client_id — pass it explicitly.'); process.exit(1); }
    console.log(`Using client_id=${clientId}\n`);

    // 2) Current stored challan row
    console.log('=== di_vehicle_challans BEFORE ===');
    const before = await VehicleChallan.findOne({ where: { client_id: clientId, vehicle_number: vehicleNumber } });
    dumpRow(before, 'before');

    // 3) Raw ULIP response (so we can see the exact no-challan envelope)
    console.log('\n=== Raw ULIP echallan response ===');
    try {
      const axios = require('axios');
      const { getValidToken } = require('./utils/ulipTokenManager');
      const token = await getValidToken();
      const resp = await axios.post(process.env.ULIP_ECHALLAN_DETAILS_URL, { vehicleNumber }, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const node = resp?.data?.response?.[0]?.response ?? null;
      console.log('  response[0].response present?', node != null);
      console.log('  response[0].response.data present?', node?.data != null);
      console.log('  Pending_data count:', Array.isArray(node?.data?.Pending_data) ? node.data.Pending_data.length : node?.data?.Pending_data);
      console.log('  Disposed_data count:', Array.isArray(node?.data?.Disposed_data) ? node.data.Disposed_data.length : node?.data?.Disposed_data);
      console.log('  Raw (first 800 chars):', JSON.stringify(resp?.data).slice(0, 800));
    } catch (e) {
      console.log('  ULIP call failed:', e.message);
    }

    // 4) Optionally apply the real service (re-fetch + cancellation)
    if (doRun) {
      console.log('\n=== Running getChallanDetails (applies cancellation) ===');
      const svc = require('./services/vehicleChallanService');
      const result = await svc.getChallanDetails(vehicleNumber, clientId);
      console.log('  service message:', result && (result.message || 'ok'));
      console.log('\n=== di_vehicle_challans AFTER ===');
      const after = await VehicleChallan.findOne({ where: { client_id: clientId, vehicle_number: vehicleNumber } });
      dumpRow(after, 'after');
    } else {
      console.log('\n(Read-only. Re-run with --run to apply the re-fetch + cancellation.)');
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('diagnose-challan failed:', err.message);
    console.error(err);
    process.exit(1);
  }
})();
