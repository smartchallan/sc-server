const vehicleDataService = require('../services/vehicleDataService');

exports.getVehicleData = async (req, res) => {
  try {
    const data = await vehicleDataService.getVehicleData(req.query);
    console.table(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
