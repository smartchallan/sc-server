const mongoose = require('mongoose');

const vehicleDataSchema = new mongoose.Schema({
  vehicle_no: { type: String, required: true },
  imei_no: { type: String, required: true },
  // Add other fields as needed
}, { collection: 'vehicle_data' });

module.exports = mongoose.model('VehicleData', vehicleDataSchema);
