const express = require('express');
const router = express.Router();
const vehicleChallanService = require('../services/vehicleChallanService');

// POST /getvehicleechallandata/batch
// Body: { vehicleNumbers: ["KA01AB1234", ...], clientID: 123, exportCsv: true }

async function processChallanBatch({ vehicleNumbers, clientID, exportCsv }) {
  if (!Array.isArray(vehicleNumbers) || vehicleNumbers.length === 0) {
    throw new Error('vehicleNumbers must be a non-empty array');
  }
  if (!clientID) {
    throw new Error('clientID is required');
  }
  console.table([{ endpoint: '/getvehicleechallandata/batch', count: vehicleNumbers.length, clientID }]);
  const service = vehicleChallanService;
  // Custom concurrency worker: 4 API calls at a time, 1 second between batches
  async function runWithConcurrencyAndDelay(items, batchSize, iteratorFn, delayMs) {
    const results = new Array(items.length);
    let i = 0;
    while (i < items.length) {
      const batch = items.slice(i, i + batchSize).map((item, idx) => {
        return iteratorFn(item).then(
          (res) => { results[i + idx] = res; },
          (err) => { results[i + idx] = { vehicleNumber: item, success: false, error: err.message }; }
        );
      });
      await Promise.all(batch);
      i += batchSize;
      if (i < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return results;
  }
  // Use 4 at a time, 1 second between batches
  const results = await runWithConcurrencyAndDelay(
    vehicleNumbers,
    4, // batch size
    async (vn) => {
      try {
        const data = await service.getChallanDetails(vn, clientID);
        return { vehicleNumber: vn, success: true, data };
      } catch (err) {
        return { vehicleNumber: vn, success: false, error: err.message };
      }
    },
    1000 // 1 second delay between batches
  );
  const successCount = results.filter(r => r.success).length;
  const failedRecords = results.filter(r => !r.success).map(r => ({ vehicleNumber: r.vehicleNumber, error: r.error }));
  // CSV export option
  if (exportCsv) {
    if (!failedRecords || failedRecords.length === 0) {
      return { success: true, message: 'No failed records to export', results };
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
    return { success: true, csv, results };
  }
  return {
    success: true,
    total: results.length,
    successfulFetched: successCount,
    failedRecords,
    results
  };
}

router.post('/', async (req, res) => {
  try {
    const { vehicleNumbers, clientID, exportCsv } = req.body;
    const result = await processChallanBatch({ vehicleNumbers, clientID, exportCsv });
    if (exportCsv && result.csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="echallan_batch_failures_${Date.now()}.csv"`);
      return res.send(result.csv);
    }
    res.json(result);
  } catch (err) {
    console.error('Batch echallan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.processChallanBatch = processChallanBatch;
