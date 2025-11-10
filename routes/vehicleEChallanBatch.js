const express = require('express');
const router = express.Router();
const vehicleChallanService = require('../services/vehicleChallanService');

// POST /getvehicleechallandata/batch
// Body: { vehicleNumbers: ["KA01AB1234", ...], clientID: 123, exportCsv: true }
router.post('/', async (req, res) => {
  try {
    const { vehicleNumbers, clientID } = req.body;

    if (!Array.isArray(vehicleNumbers) || vehicleNumbers.length === 0) {
      return res.status(400).json({ error: 'vehicleNumbers must be a non-empty array' });
    }
    if (!clientID) {
      return res.status(400).json({ error: 'clientID is required' });
    }

    console.table([{ endpoint: '/getvehicleechallandata/batch', count: vehicleNumbers.length, clientID }]);

    const service = vehicleChallanService;

    // Concurrency control
    const CONCURRENCY = parseInt(process.env.ECHALLAN_BATCH_CONCURRENCY, 10) || 5;

    async function runWithConcurrency(items, limit, iteratorFn) {
      const results = new Array(items.length);
      let idx = 0;
      const workers = Array(Math.min(limit, items.length)).fill().map(async () => {
        while (true) {
          const current = idx++;
          if (current >= items.length) break;
          const item = items[current];
          try {
            results[current] = await iteratorFn(item);
          } catch (err) {
            results[current] = { vehicleNumber: item, success: false, error: err.message };
          }
        }
      });
      await Promise.all(workers);
      return results;
    }

    const results = await runWithConcurrency(vehicleNumbers, CONCURRENCY, async (vn) => {
      try {
        const data = await service.getChallanDetails(vn, clientID);
        return { vehicleNumber: vn, success: true, data };
      } catch (err) {
        return { vehicleNumber: vn, success: false, error: err.message };
      }
    });

    const successCount = results.filter(r => r.success).length;
    const failedRecords = results.filter(r => !r.success).map(r => ({ vehicleNumber: r.vehicleNumber, error: r.error }));

    // CSV export option
    const wantCsv = (req.query && String(req.query.export).toLowerCase() === 'csv') || req.body?.exportCsv === true;
    if (wantCsv) {
      if (!failedRecords || failedRecords.length === 0) {
        return res.status(200).json({ success: true, message: 'No failed records to export' });
      }

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('\n') || s.includes('"')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const header = ['vehicleNumber', 'error'];
      const lines = [header.join(',')];
      for (const fr of failedRecords) {
        lines.push([escapeCsv(fr.vehicleNumber), escapeCsv(fr.error)].join(','));
      }
      const csv = lines.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="echallan_batch_failures_${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      total: results.length,
      successfulFetched: successCount,
      failedRecords,
      results
    });

  } catch (err) {
    console.error('Batch echallan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
