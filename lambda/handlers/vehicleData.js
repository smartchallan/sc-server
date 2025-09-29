const VehicleData = require('../../mongoose/vehicle_data');
exports.handler = async (event) => {
  try {
    const data = await VehicleData.find({});
    return { statusCode: 200, body: JSON.stringify({ vehicleData: data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
