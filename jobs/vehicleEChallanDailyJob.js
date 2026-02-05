// Vehicle EChallan Daily Job
const cron = require('node-cron');
const { User, UserVehicle } = require('../models');
const vehicleEChallanBatch = require('../routes/vehicleEChallanBatch');
require('dotenv').config();

// Get schedule from env or use default (every 6 hours)
const SCHEDULE = process.env.ECHALLAN_JOB_CRON || '0 */6 * * *';

async function runVehicleEChallanJob() {
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
      // 3. Call the batch function from vehicleEChallanBatch.js (not API)
      await vehicleEChallanBatch.processChallanBatch({
        vehicleNumbers,
        clientID: client.id,
        exportCsv: true
      });
    }
    console.log('Vehicle EChallan daily job completed.');
  } catch (err) {
    console.error('Vehicle EChallan daily job error:', err);
  }
}

// Schedule the job
cron.schedule(SCHEDULE, runVehicleEChallanJob, {
  timezone: process.env.ECHALLAN_JOB_TZ || 'Asia/Kolkata'
});

module.exports = { runVehicleEChallanJob };
