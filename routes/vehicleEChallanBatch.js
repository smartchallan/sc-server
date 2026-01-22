const express = require('express');
const router = express.Router();
const vehicleChallanService = require('../services/vehicleChallanService');
const models = require('../models');
const momentTz = require('moment-timezone');

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
        // service may return { success: true, data: { Pending_data, Disposed_data } } or the raw payload
        const payload = (data && data.success && data.data) ? data.data : data || {};

        const pendingArr = Array.isArray(payload.Pending_data) ? payload.Pending_data : (Array.isArray(payload.pending_data) ? payload.pending_data : []);
        const disposedArr = Array.isArray(payload.Disposed_data) ? payload.Disposed_data : (Array.isArray(payload.disposed_data) ? payload.disposed_data : []);

        const JobModel = models.DiVehicleChallanJob;
        const inserts = [];

        const parseIssuedAt = (val) => {
          if (!val) return null;
          const m = momentTz(val, 'DD-MM-YYYY HH:mm:ss', true);
          if (m.isValid()) return m.tz('Asia/Kolkata').toDate();
          const m2 = momentTz(val);
          return m2.isValid() ? m2.tz('Asia/Kolkata').toDate() : null;
        };

        for (const item of pendingArr) {
          try {
            const issuedAt = parseIssuedAt(item && item.challan_date_time);
            inserts.push(JobModel.create({
              vehicle_number: vn,
              client_id: clientID,
              challan_number: (item && (item.challan_no || item.challan_number)) || null,
              challan_data: item || null,
              challan_status: 'pending',
              challan_issued_at: issuedAt,
              created_at: new Date(),
              updated_at: new Date()
            }));
          } catch (e) {
            console.error('Insert pending item failed for', vn, e);
          }
        }

        for (const item of disposedArr) {
          try {
            const issuedAt = parseIssuedAt(item && item.challan_date_time);
            inserts.push(JobModel.create({
              vehicle_number: vn,
              client_id: clientID,
              challan_number: (item && (item.challan_no || item.challan_number)) || null,
              challan_data: item || null,
              challan_status: 'disposed',
              challan_issued_at: issuedAt,
              created_at: new Date(),
              updated_at: new Date()
            }));
          } catch (e) {
            console.error('Insert disposed item failed for', vn, e);
          }
        }

        if (inserts.length > 0) {
          try {
            await Promise.all(inserts);
          } catch (e) {
            console.error('Error inserting di_vehicle_challan_job rows for', vn, e);
          }
        }

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
