const driverDataService = require('../../services/driverDataService');
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { driverId } = body;
    if (!driverId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'driverId is required' }) };
    }
    const driverData = await driverDataService.getDriverData(driverId);
    return { statusCode: 200, body: JSON.stringify(driverData) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
