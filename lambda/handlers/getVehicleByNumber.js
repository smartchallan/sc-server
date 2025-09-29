const { getVehicleByNumber } = require('../../services/vehicleService');

exports.handler = async (event) => {
  try {
    const vehiclenumber = event.queryStringParameters?.vehiclenumber;
    if (!vehiclenumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'vehiclenumber is required as a query parameter' }),
      };
    }
    const result = await getVehicleByNumber(vehiclenumber);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
