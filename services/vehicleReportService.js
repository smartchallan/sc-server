const { VehicleRTOData, VehicleChallan } = require('../models');
const moment = require('moment');

/** Normalize a date string to DD-MMM-YYYY, returns null if unparseable */
function normalizeDate(val) {
  if (!val) return null;
  const formats = ['DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD'];
  let m = moment(val, formats, true);
  if (!m.isValid()) m = moment(val);
  return m.isValid() ? m.format('DD-MMM-YYYY') : null;
}

/** Normalize date fields in an array of challan objects */
function normalizeChallanDates(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    if (copy.challan_date_time) copy.challan_date_time = normalizeDate(copy.challan_date_time) || copy.challan_date_time;
    if (copy.hearing_date) copy.hearing_date = normalizeDate(copy.hearing_date) || copy.hearing_date;
    if (copy.payment_date) copy.payment_date = normalizeDate(copy.payment_date) || copy.payment_date;
    return copy;
  });
}

exports.getReport = async ({ clientID, vehicleNumber }) => {
  const vn = String(vehicleNumber).trim();
  // Fetch RTO data
  const rto = await VehicleRTOData.findOne({ where: { vehicle_number: vn, client_id: clientID } });
  // Fetch challan data
  const challan = await VehicleChallan.findOne({ where: { vehicle_number: vn, client_id: clientID } });

  return {
    vehicle_number: vn,
    client_id: clientID,
    rto_data: rto ? rto.rto_data : null,
    pending_data: normalizeChallanDates(challan && challan.pending_data ? challan.pending_data : []),
    disposed_data: normalizeChallanDates(challan && challan.disposed_data ? challan.disposed_data : [])
  };
};
