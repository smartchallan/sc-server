const { UserVehicle, VehicleChallan, VehicleRTOData } = require('../models');

function parseDateStatus(dateStr) {
  if (!dateStr) return {};
  const now = new Date();
  let date;
  // Support DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('-');
    date = new Date(`${year}-${month}-${day}`);
  } else {
    date = new Date(dateStr);
  }
  if (isNaN(date)) return {};
  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  if (date < now) return { status: 'expired' };
  if (diffDays <= 15 && diffDays >= 0) return { status: 'upcoming_renewal' };
  return { status: 'fit' };
}

exports.getSummary = async (client_id, options = {}) => {
  // Accept pagination parameters
  // Usage: getSummary(client_id, { limit, offset })
  const limit = options.limit !== undefined ? Number(options.limit) : 10;
  const offset = options.offset !== undefined ? Number(options.offset) : 0;
  // Fetch paginated vehicles and total count
  const { rows: vehicles, count: total } = await UserVehicle.findAndCountAll({
    where: { client_id, status: 'active' },
    limit,
    offset
  });
  const result = [];
  for (const vehicle of vehicles) {
    const vehicle_number = vehicle.vehicle_number;
    // Debug log for vehicle_number
    console.table({ step: 'summary-loop', vehicle_number });
    // Fetch challan data
    const challan = await VehicleChallan.findOne({ where: { vehicle_number, client_id } });
    let pendingChallanCount = 0, disposedChallanCount = 0;
    if (challan) {
      pendingChallanCount = Array.isArray(challan.pending_data) ? challan.pending_data.length : 0;
      disposedChallanCount = Array.isArray(challan.disposed_data) ? challan.disposed_data.length : 0;
    }
    // Fetch RTO data
    const rto = await VehicleRTOData.findOne({ where: { vehicle_number, client_id } });
    // Debug log for fetched RTO data (string format)
    console.log('[RTO DATA]', vehicle_number, JSON.stringify(rto ? rto.rto_data : null));
    let rtoFields = {};
    if (rto && rto.rto_data) {
      // Use VehicleDetails if present
      const d = rto.rto_data.VehicleDetails ? rto.rto_data.VehicleDetails : rto.rto_data;
      rtoFields = {
        rc_regn_dt: d.rc_regn_dt || null,
        rc_fit_upto: { value: d.rc_fit_upto || null, ...parseDateStatus(d.rc_fit_upto) },
        rc_tax_upto: { value: d.rc_tax_upto || null, ...parseDateStatus(d.rc_tax_upto) },
        rc_pucc_upto: { value: d.rc_pucc_upto || null, ...parseDateStatus(d.rc_pucc_upto) },
        rc_insurance_upto: { value: d.rc_insurance_upto || null, ...parseDateStatus(d.rc_insurance_upto) }
      };
    }
    result.push({
      ...vehicle.toJSON(),
      pending_challan_count: pendingChallanCount,
      disposed_challan_count: disposedChallanCount,
      ...rtoFields
    });
  }
  return { total, vehicles: result };
};
