const { VehicleRTOData, VehicleChallan } = require('../models');

exports.getReport = async ({ clientID, vehicleNumber }) => {
  const vn = String(vehicleNumber).trim();
  // Fetch RTO data
  const rto = await VehicleRTOData.findOne({ where: { vehicle_number: vn, client_id: clientID } });
  // Fetch challan data
  const challan = await VehicleChallan.findOne({ where: { vehicle_number: vn, client_id: clientID } });

  // Upcoming renewals filter (within 15 days)
  const upcomingRenewals = [];
  if (rto && rto.rto_data) {
    const d = rto.rto_data.VehicleDetails ? rto.rto_data.VehicleDetails : rto.rto_data;
    const dateFields = [
      { key: 'rc_fit_upto', label: 'Fitness Expiry' },
      { key: 'rc_tax_upto', label: 'Tax Expiry' },
      { key: 'rc_pucc_upto', label: 'PUCC Expiry' },
      { key: 'rc_insurance_upto', label: 'Insurance Expiry' }
    ];
    const now = new Date();
    for (const field of dateFields) {
      const dateStr = d[field.key];
      if (dateStr) {
        let date;
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
          const [day, month, year] = dateStr.split('-');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateStr);
        }
        if (!isNaN(date)) {
          const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
          if (diffDays <= 15 && diffDays >= 0) {
            upcomingRenewals.push({
              field: field.key,
              label: field.label,
              value: dateStr,
              days_left: diffDays
            });
          }
        }
      }
    }
  }

  return {
    vehicle_number: vn,
    client_id: clientID,
    rto_data: rto ? rto.rto_data : null,
    pending_data: challan && challan.pending_data ? challan.pending_data : [],
    disposed_data: challan && challan.disposed_data ? challan.disposed_data : [],
    upcoming_renewals: upcomingRenewals
  };
};
