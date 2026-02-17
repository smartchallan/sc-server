#!/usr/bin/env node

/**
 * Manual runner for Vehicle EChallan Daily Job
 * Usage: node run-daily-challan-job.js
 */

require('dotenv').config();
const { runVehicleEChallanJob } = require('./jobs/vehicleEChallanDailyJob');

console.log('Starting Vehicle EChallan Daily Job...');
console.log('Timestamp:', new Date().toISOString());

runVehicleEChallanJob()
  .then(() => {
    console.log('Job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Job failed:', error);
    process.exit(1);
  });