// Scheduler for dailyChallanNotifyJob
const cron = require('node-cron');
const dailyChallanNotifyJob = require('./dailyChallanNotifyJob');
require('dotenv').config();

// Get cron schedule and timezone from env or use default 07:00 AM IST
const SCHEDULE = process.env.DAILY_CHALLAN_NOTIFY_CRON || '0 7 * * *';
const TIMEZONE = process.env.DAILY_CHALLAN_NOTIFY_TZ || 'Asia/Kolkata';

cron.schedule(SCHEDULE, async () => {
  console.log('Running dailyChallanNotifyJob...');
  await dailyChallanNotifyJob();
}, {
  timezone: TIMEZONE
});