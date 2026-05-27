const express = require('express');
const router = express.Router();
const vehicleRTOService = require('../services/vehicleRTOService');
const vehicleChallanService = require('../services/vehicleChallanService');

// ── POST /vehiclereport/generate ─────────────────────────────────────────────

router.post('/generate', async (req, res) => {
  try {
    const { vehicleNumber, clientId } = req.body;
    if (!vehicleNumber || !clientId) {
      return res.status(400).json({ error: 'vehicleNumber and clientId are required' });
    }

    const VehicleReport = req.app.locals.models?.VehicleReport;
    const UserOptions = req.app.locals.models?.UserOptions;
    const User = req.app.locals.models?.User;

    if (!VehicleReport || !UserOptions || !User) {
      console.error('[vehicleReport] Missing models:', {
        VehicleReport: !!VehicleReport,
        UserOptions: !!UserOptions,
        User: !!User,
      });
      return res.status(500).json({ error: 'Required models not available' });
    }

    // ── 1. Resolve dealer_id ────────────────────────────────────────────────
    const clientUser = await User.findOne({ where: { id: clientId } });
    if (!clientUser) return res.status(404).json({ error: 'Client not found' });
    const dealerId = clientUser.parent_id || 0;

    // ── 2. Check feature permission ─────────────────────────────────────────
    const enabledOpt = await UserOptions.findOne({
      where: { user_id: clientId, option_key: 'vehicle_report_enabled' },
    });
    const isEnabled = enabledOpt && (enabledOpt.option_value === '1' || enabledOpt.option_value === 1);
    if (!isEnabled) {
      return res.status(403).json({ error: 'Vehicle Report feature is not enabled for this account. Please contact your dealer.' });
    }

    // ── 3. Check usage limit ────────────────────────────────────────────────
    const limitOpt = await UserOptions.findOne({
      where: { user_id: clientId, option_key: 'vehicle_report_limit' },
    });
    const limit = limitOpt ? parseInt(limitOpt.option_value, 10) : 0;
    if (limit > 0) {
      const usedCount = await VehicleReport.count({ where: { client_id: clientId } });
      if (usedCount >= limit) {
        return res.status(429).json({ error: `Vehicle report limit reached (${limit}). Please contact your dealer to increase the limit.` });
      }
    }

    // ── 4. Fetch RTO data via existing service ──────────────────────────────
    const vNum = vehicleNumber.trim().toUpperCase();
    let rto = { status: 'failed', data: null };
    let challan = { status: 'failed', data: null };

    try {
      const rtoData = await vehicleRTOService.getRTODetails(vNum, clientId);
      rto = { status: 'success', data: rtoData };
    } catch (err) {
      if (err.code === 'ULIP_QUOTA_EXCEEDED') throw err;
      console.error('[vehicleReport] RTO fetch error:', err.message);
      rto = { status: 'failed', data: null };
    }

    // ── 5. Fetch Challan data via existing service ──────────────────────────
    try {
      const challanResult = await vehicleChallanService.getChallanDetails(vNum, clientId);
      // Service returns { success: true, message: '...no challan...' } when no challans
      if (challanResult && challanResult.success && challanResult.message) {
        challan = { status: 'no_challans', data: { Pending_data: null, Disposed_data: null } };
      } else {
        const hasPending = challanResult?.Pending_data && (Array.isArray(challanResult.Pending_data) ? challanResult.Pending_data.length > 0 : true);
        const hasDisposed = challanResult?.Disposed_data && (Array.isArray(challanResult.Disposed_data) ? challanResult.Disposed_data.length > 0 : true);
        challan = {
          status: hasPending || hasDisposed ? 'success' : 'no_challans',
          data: {
            Pending_data: challanResult?.Pending_data || null,
            Disposed_data: challanResult?.Disposed_data || null,
          },
        };
      }
    } catch (err) {
      if (err.code === 'ULIP_QUOTA_EXCEEDED') throw err;
      console.error('[vehicleReport] Challan fetch error:', err.message);
      challan = { status: 'failed', data: null };
    }

    // ── 6. Store report ─────────────────────────────────────────────────────
    const expiryDays = parseInt(process.env.VEHICLE_REPORT_EXPIRY_DAYS || '30', 10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const report = await VehicleReport.create({
      client_id: clientId,
      dealer_id: dealerId,
      vehicle_number: vNum,
      rto_data: rto.data,
      challan_data: challan.data,
      rto_status: rto.status,
      challan_status: challan.status,
      status: 'active',
      generated_at: now,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    });

    return res.json({
      success: true,
      report_id: report.id,
      vehicle_number: vNum,
      rto_status: rto.status,
      challan_status: challan.status,
      rto_data: rto.data,
      challan_data: challan.data,
      generated_at: now,
      expires_at: expiresAt,
      expiry_days: expiryDays,
    });
  } catch (err) {
    if (err.code === 'ULIP_QUOTA_EXCEEDED') {
      return res.status(429).json({ error: 'ULIP_QUOTA_EXCEEDED', message: 'Daily API quota exhausted. Please try again tomorrow.' });
    }
    console.error('[vehicleReport] generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /vehiclereport/list?client_id=X ──────────────────────────────────────

router.get('/list', async (req, res) => {
  try {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    const VehicleReport = req.app.locals.models?.VehicleReport;
    if (!VehicleReport) return res.status(500).json({ error: 'VehicleReport model not available' });

    const reports = await VehicleReport.findAll({
      where: { client_id },
      attributes: ['id', 'vehicle_number', 'rto_status', 'challan_status', 'status', 'generated_at', 'expires_at'],
      order: [['generated_at', 'DESC']],
    });

    const now = new Date();
    const mapped = reports.map(r => ({
      id: r.id,
      vehicle_number: r.vehicle_number,
      rto_status: r.rto_status,
      challan_status: r.challan_status,
      status: r.expires_at && new Date(r.expires_at) < now ? 'expired' : r.status,
      generated_at: r.generated_at,
      expires_at: r.expires_at,
    }));

    const limitOpt = await req.app.locals.models.UserOptions?.findOne({
      where: { user_id: client_id, option_key: 'vehicle_report_limit' },
    });
    const limit = limitOpt ? parseInt(limitOpt.option_value, 10) : 0;

    return res.json({ success: true, reports: mapped, total: mapped.length, limit });
  } catch (err) {
    console.error('[vehicleReport] list error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /vehiclereport/:id ────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const VehicleReport = req.app.locals.models?.VehicleReport;
    if (!VehicleReport) return res.status(500).json({ error: 'VehicleReport model not available' });

    const report = await VehicleReport.findOne({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const now = new Date();
    const isExpired = report.expires_at && new Date(report.expires_at) < now;

    return res.json({
      success: true,
      id: report.id,
      vehicle_number: report.vehicle_number,
      rto_status: report.rto_status,
      challan_status: report.challan_status,
      status: isExpired ? 'expired' : report.status,
      rto_data: report.rto_data,
      challan_data: report.challan_data,
      generated_at: report.generated_at,
      expires_at: report.expires_at,
    });
  } catch (err) {
    console.error('[vehicleReport] get error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
