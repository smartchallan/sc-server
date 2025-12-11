const vehicleReportService = require('../services/vehicleReportService');

exports.getVehicleReport = async (req, res) => {
  try {
    const { clientID, vehicleNumber } = req.body;
    if (!clientID || !vehicleNumber) {
      return res.status(400).json({ success: false, error: 'clientID and vehicleNumber are required' });
    }
    const report = await vehicleReportService.getReport({ clientID: Number(clientID), vehicleNumber });
    res.json({ success: true, data: report });
  } catch (err) {
    console.error('Error in getVehicleReport:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
