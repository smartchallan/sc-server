const express = require('express');

// Exposes the most recent successful run time of the background data jobs so
// the UI can show "RTO data updated …" / "Challans updated …" on the
// Registered Vehicles page.
module.exports = (models) => {
  const router = express.Router();
  const { ScheduledJobRecords } = models;

  // job_name values written by the schedulers:
  //   - vehicleRTOBatchJob       (jobs/vehicleRTOBatchJob.js)
  //   - vehicle_echallan_batch   (jobs/vehicleEChallanBatchScheduler.js)
  const JOB_NAMES = {
    rto: 'vehicleRTOBatchJob',
    challan: 'vehicle_echallan_batch',
  };

  const latestRun = async (jobName) => {
    // Prefer the latest successful completion; fall back to the latest record.
    const record =
      (await ScheduledJobRecords.findOne({
        where: { job_name: jobName, job_status: 'success' },
        order: [['job_completed_at', 'DESC']],
      })) ||
      (await ScheduledJobRecords.findOne({
        where: { job_name: jobName },
        order: [['job_started_at', 'DESC']],
      }));
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
