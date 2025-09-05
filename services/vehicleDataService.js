const VehicleData = require('../mongoose/vehicle_data');

exports.getVehicleData = async (query) => {
  const mongoQuery = {};
  if (query.vehicle_no) mongoQuery.vehicle_no = query.vehicle_no;
  if (query.imei_no) mongoQuery.imei_no = query.imei_no;
  return await VehicleData.find(mongoQuery);
};
