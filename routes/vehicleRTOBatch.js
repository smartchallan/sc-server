const express = require('express');
const router = express.Router();
const vehicleRTOService = require('../services/vehicleRTOService');


// Extracted batch logic for direct use
async function processRTOBatch({ vehicleNumbers, clientID }) {
  if (!Array.isArray(vehicleNumbers) || vehicleNumbers.length === 0) {
    throw new Error('vehicleNumbers must be a non-empty array');
  }
  if (!clientID) {
    throw new Error('clientID is required');
  }
  console.table([{ endpoint: '/getvehiclertodata/batch', count: vehicleNumbers.length, clientID }]);
  const service = vehicleRTOService;
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
  const results = await runWithConcurrencyAndDelay(
    vehicleNumbers,
    4, // batch size
    async (vn) => {
      try {
        const data = await service.getRTODetails(vn, clientID);
        return { vehicleNumber: vn, success: true, data };
      } catch (err) {
        return { vehicleNumber: vn, success: false, error: err.message };
      }
    },
    1000 // 1 second delay between batches
  );
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;
  const failedRecords = results.filter(r => !r.success).map(r => ({ vehicleNumber: r.vehicleNumber, error: r.error }));
  return {
    success: true,
    total: results.length,
    successfulFetched: successCount,
    failedRecords,
    results
  };
}

// POST /getvehiclertodata/batch
router.post('/', async (req, res) => {
  try {
    const { vehicleNumbers, clientID } = req.body;
    const batchResult = await processRTOBatch({ vehicleNumbers, clientID });
    // CSV export logic (unchanged)
    const wantCsv = (req.query && String(req.query.export).toLowerCase() === 'csv') || req.body?.exportCsv === true;
    if (wantCsv) {
      const failedRecords = batchResult.failedRecords;
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
      res.setHeader('Content-Disposition', `attachment; filename="rto_batch_failures_${Date.now()}.csv"`);
      return res.send(csv);
    }
    res.json(batchResult);
  } catch (err) {
    console.error('Batch RTO error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.processRTOBatch = processRTOBatch;
