const vehicleSummaryService = require('../services/vehicleSummaryService');

exports.getVehicleSummary = async (req, res) => {
  try {
    const { client_id } = req.body;
  let limit = req.body.limit !== undefined ? Number(req.body.limit) : undefined;
  let offset = req.body.offset !== undefined ? Number(req.body.offset) : undefined;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }
  const { total, vehicles } = await vehicleSummaryService.getSummary(client_id, { limit, offset });
  res.json({ total, vehicles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
