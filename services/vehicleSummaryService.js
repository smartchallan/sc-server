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
  let findOptions = {
    where: { client_id, status: 'active' },
    order: [['registered_at', 'DESC']]
  };
  if (options.limit !== undefined) findOptions.limit = Number(options.limit);
  if (options.offset !== undefined) findOptions.offset = Number(options.offset);
  // Fetch vehicles and total count
  const { rows: vehicles, count: total } = await UserVehicle.findAndCountAll(findOptions);
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
        rc_tax_upto: {
          value: d.rc_tax_upto ? formatDateToDDMMMYYYY(d.rc_tax_upto) : null,
          ...parseDateStatus(d.rc_tax_upto)
        },
        rc_pucc_upto: { value: d.rc_pucc_upto || null, ...parseDateStatus(d.rc_pucc_upto) },
        rc_insurance_upto: { value: d.rc_insurance_upto || null, ...parseDateStatus(d.rc_insurance_upto) }
      };
    }
    result.push({
      ...vehicle.toJSON(),
      registered_at: vehicle.registered_at,
      pending_challan_count: pendingChallanCount,
      disposed_challan_count: disposedChallanCount,
      ...rtoFields
    });
  }
  return { total, vehicles: result };
};
