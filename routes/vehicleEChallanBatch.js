const express = require('express');
const router = express.Router();
const vehicleChallanService = require('../services/vehicleChallanService');
const models = require('../models');
const momentTz = require('moment-timezone');

// POST /getvehicleechallandata/batch
// Body: { vehicleNumbers: ["KA01AB1234", ...], clientID: 123, exportCsv: true }

async function processChallanBatch({
  vehicleNumbers,
  clientID,
  exportCsv,
  batchSize = parseInt(process.env.ULIP_BATCH_CONCURRENCY, 10) || 4,
  delayMs   = parseInt(process.env.ULIP_BATCH_DELAY_MS, 10)    || 1000,
}) {
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
  const results = await runWithConcurrencyAndDelay(
    vehicleNumbers,
    batchSize,
    async (vn) => {
      try {
        const data = await service.getChallanDetails(vn, clientID);
        // service may return { success: true, data: { Pending_data, Disposed_data } } or the raw payload
        const payload = (data && data.success && data.data) ? data.data : data || {};

        const pendingArr = Array.isArray(payload.Pending_data) ? payload.Pending_data : (Array.isArray(payload.pending_data) ? payload.pending_data : []);
        const disposedArr = Array.isArray(payload.Disposed_data) ? payload.Disposed_data : (Array.isArray(payload.disposed_data) ? payload.disposed_data : []);

        const JobModel = models.DiVehicleChallanJob;

        const parseIssuedAt = (val) => {
          if (!val) return null;
          const m = momentTz(val, 'DD-MM-YYYY HH:mm:ss', true);
          if (m.isValid()) return m.tz('Asia/Kolkata').toDate();
          const m2 = momentTz(val);
          return m2.isValid() ? m2.tz('Asia/Kolkata').toDate() : null;
        };

        const parseBool = (v) => {
          if (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true') return true;
          return false;
        };

        // Only process pending challans. Skip disposedArr entirely.
        for (const item of pendingArr) {
          try {
            const challanNo = item && (item.challan_no || item.challan_number);
            if (!challanNo) {
              console.warn('Skipping pending item without challan number for', vn);
              continue;
            }
            const issuedAt = parseIssuedAt(item && item.challan_date_time);
            const payloadData = item || null;
            const stateCode = item && (item.state_code || item.state) || null;
            const rtoName = item && (item.rto_distric_name || item.rto_district_name || item.rto_district) || null;
            const sentToRegCourt = parseBool(item && item.sent_to_reg_court);
            const sentToVirtualCourt = parseBool(item && item.sent_to_virtual_court);
            const fineImposed = item && (item.fine_imposed || item.fine_amount || item.penalty_amount) ? parseFloat(item.fine_imposed || item.fine_amount || item.penalty_amount) : null;

            // Lookup by challan_number; update if exists, otherwise create
            try {
              const existing = await JobModel.findOne({ where: { challan_number: challanNo } });
              if (existing) {
                await existing.update({
                  vehicle_number: vn,
                  client_id: clientID,
                  challan_data: payloadData,
                  challan_status: 'pending',
                  challan_issued_at: issuedAt,
                  state_code: stateCode,
                  rto_distric_name: rtoName,
                  sent_to_reg_court: sentToRegCourt,
                  sent_to_virtual_court: sentToVirtualCourt,
                  fine_imposed: fineImposed,
                  updated_at: new Date()
                });
              } else {
                await JobModel.create({
                  vehicle_number: vn,
                  client_id: clientID,
                  challan_number: challanNo,
                  challan_data: payloadData,
                  challan_status: 'pending',
                  challan_issued_at: issuedAt,
                  state_code: stateCode,
                  rto_distric_name: rtoName,
                  sent_to_reg_court: sentToRegCourt,
                  sent_to_virtual_court: sentToVirtualCourt,
                  fine_imposed: fineImposed,
                  created_at: new Date(),
                  updated_at: new Date()
                });
              }
            } catch (dbErr) {
              console.error('DB error upserting challan job for', vn, challanNo, dbErr);
            }
          } catch (e) {
            console.error('Process pending item failed for', vn, e);
          }
        }

        // Also process disposed challans and insert/update with status 'disposed'
        for (const item of disposedArr) {
          try {
            const challanNo = item && (item.challan_no || item.challan_number);
            if (!challanNo) {
              console.warn('Skipping disposed item without challan number for', vn);
              continue;
            }
            const issuedAt = parseIssuedAt(item && item.challan_date_time);
            const payloadData = item || null;
            const stateCode = item && (item.state_code || item.state) || null;
            const rtoName = item && (item.rto_distric_name || item.rto_district_name || item.rto_district) || null;
            const sentToRegCourt = parseBool(item && item.sent_to_reg_court);
            const sentToVirtualCourt = parseBool(item && item.sent_to_virtual_court);
            const fineImposed = item && (item.fine_imposed || item.fine_amount || item.penalty_amount) ? parseFloat(item.fine_imposed || item.fine_amount || item.penalty_amount) : null;
            const finePaid = item && (item.received_amount || item.amount_paid || item.paid_amount) ? parseFloat(item.received_amount || item.amount_paid || item.paid_amount) : null;

            // Lookup by challan_number; update if exists, otherwise create
            try {
              const existing = await JobModel.findOne({ where: { challan_number: challanNo } });
              if (existing) {
                await existing.update({
                  vehicle_number: vn,
                  client_id: clientID,
                  challan_data: payloadData,
                  challan_status: 'disposed',
                  challan_issued_at: issuedAt,
                  state_code: stateCode,
                  rto_distric_name: rtoName,
                  sent_to_reg_court: sentToRegCourt,
                  sent_to_virtual_court: sentToVirtualCourt,
                  fine_imposed: fineImposed,
                  fine_paid: finePaid,
                  updated_at: new Date()
                });
              } else {
                await JobModel.create({
                  vehicle_number: vn,
                  client_id: clientID,
                  challan_number: challanNo,
                  challan_data: payloadData,
                  challan_status: 'disposed',
                  challan_issued_at: issuedAt,
                  state_code: stateCode,
                  rto_distric_name: rtoName,
                  sent_to_reg_court: sentToRegCourt,
                  sent_to_virtual_court: sentToVirtualCourt,
                  fine_imposed: fineImposed,
                  fine_paid: finePaid,
                  created_at: new Date(),
                  updated_at: new Date()
                });
              }
            } catch (dbErr) {
              console.error('DB error upserting disposed challan job for', vn, challanNo, dbErr);
            }
          } catch (e) {
            console.error('Process disposed item failed for', vn, e);
          }
        }

        // Cancellation sweep: any challan still marked 'pending' in the DB for this
        // vehicle whose number ULIP did not return this run has been cancelled at
        // source. (Runs on the success path only; if the fetch had failed we would
        // not reach here, so a transient API error never wrongly cancels challans.)
        try {
          const JobModel2 = models.DiVehicleChallanJob;
          const freshNos = new Set();
          [...pendingArr, ...disposedArr].forEach((it) => {
            const n = it && (it.challan_no || it.challan_number);
            if (n) freshNos.add(String(n));
          });
          const pendingRows = await JobModel2.findAll({
            where: { vehicle_number: vn, client_id: clientID, challan_status: 'pending' }
          });
          for (const row of pendingRows) {
            if (!freshNos.has(String(row.challan_number))) {
              await row.update({ challan_status: 'cancelled', updated_at: new Date() });
            }
          }
        } catch (sweepErr) {
          console.error('Cancellation sweep failed for', vn, sweepErr);
        }

        return { vehicleNumber: vn, success: true, data };
      } catch (err) {
        return { vehicleNumber: vn, success: false, error: err.message };
      }
    },
    delayMs
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
