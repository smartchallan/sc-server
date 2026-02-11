// Scheduler for expiredInsuranceNotificationJob
const cron = require('node-cron');
const expiredInsuranceNotificationJob = require('./expiredInsuranceNotificationJob');
require('dotenv').config();

// Default: every Wednesday at 09:15 IST. Override with EXPIRED_INSURANCE_NOTIFY_CRON / TZ
const SCHEDULE = process.env.EXPIRED_INSURANCE_NOTIFY_CRON || '15 9 * * 3';
const TIMEZONE = process.env.EXPIRED_INSURANCE_NOTIFY_TZ || 'Asia/Kolkata';

cron.schedule(SCHEDULE, async () => {
  console.log('Running expiredInsuranceNotificationJob...');
  await expiredInsuranceNotificationJob();
}, {
  timezone: TIMEZONE
});

console.log(`Scheduled expiredInsuranceNotificationJob: cron='${SCHEDULE}', tz='${TIMEZONE}'`);
