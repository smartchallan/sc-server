const cron = require('node-cron');
const runVehicleExpiryJob = require('./vehicleExpiryJob');
require('dotenv').config();

// Every night at 2:00 AM IST by default.
const SCHEDULE = process.env.VEHICLE_EXPIRY_JOB_CRON || '0 2 * * *';
const TIMEZONE = process.env.VEHICLE_EXPIRY_JOB_TZ || 'Asia/Kolkata';

cron.schedule(SCHEDULE, async () => {
  console.log('[vehicleExpiryScheduler] Running vehicleExpiryJob...');
  try {
    await runVehicleExpiryJob();
  } catch (err) {
    console.error('[vehicleExpiryScheduler] job failed:', err && err.message ? err.message : err);
  }
}, { timezone: TIMEZONE });

console.log(`[vehicleExpiryScheduler] Scheduled — "${SCHEDULE}" (${TIMEZONE})`);
