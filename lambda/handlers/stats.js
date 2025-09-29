const { getDealerCount, getClientCount, getVehicleCount } = require('../../services/countService');

exports.getDealerCount = async (event) => {
  try {
    const admin_id = event.queryStringParameters?.admin_id;
    if (!admin_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'admin_id is required' }) };
    }
    const count = await getDealerCount(admin_id);
    return { statusCode: 200, body: JSON.stringify({ count }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.getClientCount = async (event) => {
  try {
    const admin_id = event.queryStringParameters?.admin_id;
    if (!admin_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'admin_id is required' }) };
    }
    const count = await getClientCount(admin_id);
    return { statusCode: 200, body: JSON.stringify({ count }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.getVehicleCount = async (event) => {
  try {
    const count = await getVehicleCount();
    return { statusCode: 200, body: JSON.stringify({ count }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
