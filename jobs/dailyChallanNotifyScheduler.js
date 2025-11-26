// Scheduler for dailyChallanNotifyJob
const cron = require('node-cron');
const dailyChallanNotifyJob = require('./dailyChallanNotifyJob');
require('dotenv').config();

// Get cron schedule and timezone from env or use default 06:15 AM IST
const SCHEDULE = process.env.DAILY_CHALLAN_NOTIFY_CRON || '15 6 * * *';
const TIMEZONE = process.env.DAILY_CHALLAN_NOTIFY_TZ || 'Asia/Kolkata';

cron.schedule(SCHEDULE, async () => {
  console.log('Running dailyChallanNotifyJob...');
  await dailyChallanNotifyJob();
}, {
  timezone: TIMEZONE
});