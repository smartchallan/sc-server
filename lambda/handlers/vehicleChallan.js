const vehicleChallanService = require('../../services/vehicleRTOService');
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { vehicleNumber } = body;
    if (!vehicleNumber) {
      return { statusCode: 400, body: JSON.stringify({ error: 'vehicleNumber is required' }) };
    }
    const challanDetails = await vehicleChallanService.getChallanDetails(vehicleNumber);
    return { statusCode: 200, body: JSON.stringify(challanDetails) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
