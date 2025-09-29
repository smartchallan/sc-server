const VehicleData = require('../../mongoose/vehicle_data');

module.exports.trackVehicle = async (event) => {
  try {
    const { vehicleNumber } = event.queryStringParameters || {};
    if (!vehicleNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'vehicleNumber is required' })
      };
    }
    // Find vehicle data by number
    const vehicle = await VehicleData.findOne({ vehicleNumber });
    if (!vehicle) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Vehicle not found' })
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(vehicle)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
