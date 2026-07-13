/**
 * Single-vehicle VAHAN/04 test for the RTO service.
 *   node test-rto-vahan04.js <VEHICLE_NUMBER> <CLIENT_ID>
 *
 * Runs the real getRTODetails() path: ULIP VAHAN/04 call → camelCase→snake_case
 * normalization → DB save → returns { VehicleDetails: {...} }. Prints the key
 * fields so you can confirm the JSON was parsed and normalized correctly.
 *
 * NOTE: this makes one live ULIP call and writes one row to di_vehicle_rto_data
 * for the given client (create/update), so use a real vehicle + client id.
 */
require('dotenv').config();
const { getRTODetails } = require('./services/vehicleRTOService');

const vehicleNumber = (process.argv[2] || '').toUpperCase().trim();
const clientID = process.argv[3];

if (!vehicleNumber || !clientID) {
  console.error('Usage: node test-rto-vahan04.js <VEHICLE_NUMBER> <CLIENT_ID>');
  process.exit(1);
}

(async () => {
  console.log(`\nVAHAN URL: ${process.env.ULIP_VAHAN_DETAILS_URL}`);
  console.log(`Testing vehicle=${vehicleNumber} client=${clientID}\n`);

  try {
    const result = await getRTODetails(vehicleNumber, clientID);
    const vd = result?.VehicleDetails || {};

    console.log('\n──────── NORMALIZED RESULT ────────');
    console.log('stautsMessage      :', vd.stautsMessage);
    console.log('rc_regn_no         :', vd.rc_regn_no);
    console.log('rc_owner_name      :', vd.rc_owner_name);
    console.log('rc_maker_model     :', vd.rc_maker_model);
    console.log('rc_insurance_upto  :', vd.rc_insurance_upto);
    console.log('rc_fit_upto        :', vd.rc_fit_upto);
    console.log('rc_tax_upto        :', vd.rc_tax_upto);
    console.log('rc_pucc_upto       :', vd.rc_pucc_upto);
    console.log('snake_case keys    :', Object.keys(vd).filter(k => k.includes('_')).length);
    console.log('camelCase retained :', vd.rcRegnNo !== undefined ? 'yes (VAHAN/04 JSON)' : 'no (XML / not-found)');
    console.log('───────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('\nTEST FAILED:', err.message);
    if (err.code === 'ULIP_QUOTA_EXCEEDED') console.error('(ULIP daily quota reached)');
    process.exit(1);
  }
})();
