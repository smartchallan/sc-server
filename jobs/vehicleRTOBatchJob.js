// Vehicle RTO Batch Job
const cron = require('node-cron');
const { User, UserVehicle } = require('../models');
const { processRTOBatch } = require('../routes/vehicleRTOBatch');
require('dotenv').config();

// Schedule for 9:00 AM IST daily
const SCHEDULE = process.env.RTO_JOB_CRON || '15 10 * * *';


const { ScheduledJobRecords } = require('../models');
const moment = require('moment-timezone');

async function runVehicleRTOBatchJob() {
  const jobStart = new Date();
  let jobRecord;
  let jobStatus = 'success';
  let jobError = null;
  const { Op } = require('sequelize');
  try {
    console.log(`[${moment().format()}] [RTO-BATCH] Job started.`);
    // Record job start
    jobRecord = await ScheduledJobRecords.create({
      job_name: 'vehicleRTOBatchJob',
      job_status: 'started',
      job_started_at: jobStart
    });
    // 1. Fetch all client accounts (parent_id > 0 means they belong to an admin/dealer)
    //    Note: 'role' column is not in the Sequelize model; use parent_id to identify clients
    const clients = await User.findAll({
      where: { status: 'active', parent_id: { [Op.gt]: 0 } },
      attributes: ['id', 'parent_id']
    });
    console.log(`[${moment().format()}] [RTO-BATCH] Active clients found: ${clients.length}`, clients.map(c => c.id));
    let totalSuccess = 0;
    let totalFailed = 0;
    for (let ci = 0; ci < clients.length; ci++) {
      const client = clients[ci];
      // 2. For every client, fetch all active vehicle numbers
      const vehicles = await UserVehicle.findAll({
        where: { client_id: client.id, status: 'active' },
        attributes: ['vehicle_number']
      });
      const vehicleNumbers = vehicles.map(v => v.vehicle_number).filter(Boolean);
      console.log(`[${moment().format()}] [RTO-BATCH] Client ${client.id}: ${vehicleNumbers.length} active vehicles`);
      if (vehicleNumbers.length === 0) continue;
      // 3. Call the batch function with reduced concurrency to avoid ULIP rate limiting
      try {
        const batchResult = await processRTOBatch({
          vehicleNumbers,
          clientID: client.id,
          batchSize: 2,    // 2 concurrent API calls (down from 4) to avoid rate limiting
          delayMs: 3000    // 3s between batches (up from 1s)
        });
        totalSuccess += batchResult.successfulFetched || 0;
        totalFailed += (batchResult.failedRecords || []).length;
        console.log(`[${moment().format()}] [RTO-BATCH] Client ${client.id}: ${batchResult.successfulFetched}/${batchResult.total} succeeded`);
        if (batchResult.failedRecords && batchResult.failedRecords.length > 0) {
          console.warn(`[${moment().format()}] [RTO-BATCH] Client ${client.id} failures:`, batchResult.failedRecords.map(f => `${f.vehicleNumber}: ${f.error}`));
        }
      } catch (err) {
        console.error(`[${moment().format()}] [RTO-BATCH] Batch error for client ${client.id}:`, err.message);
      }
      // 4. Pause 5s between clients to give ULIP API breathing room
      if (ci < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    console.log(`[${moment().format()}] [RTO-BATCH] Job completed. Total success: ${totalSuccess}, Total failed: ${totalFailed}`);
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
