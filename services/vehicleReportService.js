const { VehicleRTOData, VehicleChallan } = require('../models');

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
    pending_data: challan && challan.pending_data ? challan.pending_data : [],
    disposed_data: challan && challan.disposed_data ? challan.disposed_data : []
  };
};
