const fastagDataService = require('../../services/fastagDataService');
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { fastagNumber } = body;
    if (!fastagNumber) {
      return { statusCode: 400, body: JSON.stringify({ error: 'fastagNumber is required' }) };
    }
    const fastagData = await fastagDataService.getFastagData(fastagNumber);
    return { statusCode: 200, body: JSON.stringify(fastagData) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
