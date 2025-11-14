// Scheduled job to run vehicle challan batch once a day at a configurable time
const cron = require('node-cron');
const { User, UserVehicle, ScheduledJobRecords } = require('../models');
const { processChallanBatch } = require('../routes/vehicleEChallanBatch');
require('dotenv').config();

// Get cron schedule from env or default to 12:15 PM every day
const SCHEDULE = process.env.ECHALLAN_JOB_CRON || '15 12 * * *';
const TIMEZONE = process.env.ECHALLAN_JOB_TZ || 'Asia/Kolkata';

async function runVehicleEChallanBatchJob() {
  const jobStart = new Date();
  let jobStatus = 'success';
  let errorMsg = null;
  try {
    // 1. Fetch all users with role 'client' and status 'active'
    const clients = await User.findAll({
      where: { role: 'client', status: 'active' },
      attributes: ['id']
    });
    for (const client of clients) {
      // 2. For every client, fetch all active vehicle numbers
      const vehicles = await UserVehicle.findAll({
        where: { client_id: client.id, status: 'active' },
        attributes: ['vehicle_number']
      });
      const vehicleNumbers = vehicles.map(v => v.vehicle_number);
      if (vehicleNumbers.length === 0) continue;
      // 3. Call the batch function
      await processChallanBatch({
        vehicleNumbers,
        clientID: client.id,
        exportCsv: true
      });
    }
    console.log('Vehicle EChallan batch job completed.');
  } catch (err) {
    jobStatus = 'failed';
    errorMsg = err.message;
    console.error('Vehicle EChallan batch job error:', err);
  } finally {
    const jobEnd = new Date();
    const duration = Math.floor((jobEnd - jobStart) / 1000); // seconds
    await ScheduledJobRecords.create({
      job_name: 'vehicle_echallan_batch',
      job_status: jobStatus + (errorMsg ? (': ' + errorMsg) : ''),
      job_started_at: jobStart,
      job_completed_at: jobEnd,
      job_duration: duration
    });
  }
}

// Schedule the job
cron.schedule(SCHEDULE, runVehicleEChallanBatchJob, {
  timezone: TIMEZONE
});

module.exports = { runVehicleEChallanBatchJob };
