// Vehicle RTO Batch Job
const cron = require('node-cron');
const { User, UserVehicle } = require('../models');
const { processRTOBatch } = require('../routes/vehicleRTOBatch');
require('dotenv').config();

// Schedule for 2:30 PM IST
const SCHEDULE = process.env.RTO_JOB_CRON || '30 14 * * *';


const { ScheduledJobRecords } = require('../models');
const moment = require('moment-timezone');

async function runVehicleRTOBatchJob() {
  const jobStart = new Date();
  let jobRecord;
  let jobStatus = 'success';
  let jobError = null;
  try {
    console.log(`[${moment().format()}] [RTO-BATCH] Job started.`);
    // Record job start
    jobRecord = await ScheduledJobRecords.create({
      job_name: 'vehicleRTOBatchJob',
      job_status: 'started',
      job_started_at: jobStart
    });
    // 1. Fetch all users with role 'client' and status 'active'
    const clients = await User.findAll({
      where: { role: 'client', status: 'active' },
      attributes: ['id']
    });
    console.log(`[${moment().format()}] [RTO-BATCH] Active clients:`, clients.map(c => c.id));
    for (const client of clients) {
      // 2. For every client, fetch all active vehicle numbers
      const vehicles = await UserVehicle.findAll({
        where: { client_id: client.id, status: 'active' },
        attributes: ['vehicle_number']
      });
      const vehicleNumbers = vehicles.map(v => v.vehicle_number);
      console.log(`[${moment().format()}] [RTO-BATCH] Client ${client.id} active vehicles:`, vehicleNumbers);
      if (vehicleNumbers.length === 0) continue;
      // 3. Call the batch function directly
      try {
        const batchResult = await processRTOBatch({ vehicleNumbers, clientID: client.id });
        console.log(`[${moment().format()}] [RTO-BATCH] Batch result:`, batchResult);
      } catch (err) {
        console.error(`[${moment().format()}] [RTO-BATCH] Batch error for client ${client.id}:`, err);
      }
    }
    console.log(`[${moment().format()}] [RTO-BATCH] Job completed.`);
  } catch (err) {
    jobStatus = 'failed';
    jobError = err.message;
    console.error(`[${moment().format()}] [RTO-BATCH] Job error:`, err);
  } finally {
    const jobEnd = new Date();
    const duration = Math.floor((jobEnd - jobStart) / 1000);
    if (jobRecord) {
      await jobRecord.update({
        job_status: jobStatus,
        job_completed_at: jobEnd,
        job_duration: duration
      });
    } else {
      // If jobRecord creation failed, try to log it
      try {
        await ScheduledJobRecords.create({
          job_name: 'vehicleRTOBatchJob',
          job_status: jobStatus,
          job_started_at: jobStart,
          job_completed_at: jobEnd,
          job_duration: duration
        });
      } catch (e) {
        console.error(`[${moment().format()}] [RTO-BATCH] Failed to record job in di_scheduled_job_records:`, e);
      }
    }
  }
}

// Schedule the job
cron.schedule(SCHEDULE, runVehicleRTOBatchJob, {
  timezone: process.env.RTO_JOB_TZ || 'Asia/Kolkata'
});

module.exports = { runVehicleRTOBatchJob };

if (require.main === module) {
  runVehicleRTOBatchJob().then(() => {
    console.log('Manual RTO batch job run complete.');
    process.exit(0);
  }).catch((err) => {
    console.error('Manual RTO batch job run failed:', err);
    process.exit(1);
  });
}
