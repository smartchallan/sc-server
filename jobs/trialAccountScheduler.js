const cron = require('node-cron');
const runTrialAccountJob = require('./trialAccountJob');
require('dotenv').config();

const SCHEDULE = process.env.TRIAL_ACCOUNT_JOB_CRON || '0 11 * * *';
const TIMEZONE = process.env.TRIAL_ACCOUNT_JOB_TZ || 'Asia/Kolkata';

cron.schedule(SCHEDULE, async () => {
  console.log('[trialAccountScheduler] Running trialAccountJob...');
  await runTrialAccountJob();
}, { timezone: TIMEZONE });

console.log(`[trialAccountScheduler] Scheduled — "${SCHEDULE}" (${TIMEZONE})`);
