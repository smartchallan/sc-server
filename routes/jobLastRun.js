const express = require('express');
const { Op } = require('sequelize');

// Exposes the most recent run time of the background data jobs so the UI can
// show "RTO data updated …" / "Challans updated …" on the Registered Vehicles page.
module.exports = (models) => {
  const router = express.Router();
  const { ScheduledJobRecords } = models;

  // job_name values written by the schedulers. Multiple candidates are listed so
  // the lookup is resilient to naming differences between deployments:
  //   - RTO:     jobs/vehicleRTOBatchJob.js          -> 'vehicleRTOBatchJob'
  //   - Challan: jobs/vehicleEChallanBatchScheduler  -> 'vehicle_echallan_batch'
  const JOB_NAMES = {
    rto: ['vehicleRTOBatchJob', 'vehicle_rto_batch', 'vehicleRTOBatch', 'rto_batch'],
    challan: ['vehicle_echallan_batch', 'vehicleEChallanBatchJob', 'vehicle_challan_batch', 'echallan_batch'],
  };

  const latestRun = async (names) => {
    // Latest run by completion time (falls back to start time); any status counts,
    // so a run always surfaces even if it failed. Prefer successful runs when present.
    const base = { job_name: { [Op.in]: names } };
    const success = await ScheduledJobRecords.findOne({
      where: { ...base, job_status: { [Op.like]: 'success%' } },
      order: [['job_completed_at', 'DESC'], ['job_started_at', 'DESC']],
    });
    const record = success || await ScheduledJobRecords.findOne({
      where: base,
      order: [['job_started_at', 'DESC']],
    });
    if (!record) return null;
    return {
      at: record.job_completed_at || record.job_started_at || null,
      status: record.job_status || null,
    };
  };

  // GET /joblastrun  ->  { rto: {at, status}|null, challan: {at, status}|null }
  router.get('/', async (req, res) => {
    try {
      const [rto, challan] = await Promise.all([
        latestRun(JOB_NAMES.rto),
        latestRun(JOB_NAMES.challan),
      ]);
      res.json({ rto, challan });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
