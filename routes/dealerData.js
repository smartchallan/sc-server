const express = require('express');
const router = express.Router();
const dealerDataService = require('../services/dealerDataService');

module.exports = (models) => {
  // GET /dealerdata?dealer_id=123
  router.get('/', async (req, res) => {
    try {
      const { dealer_id } = req.query;

      // Logging request
      console.table([{ dealer_id, endpoint: '/dealerdata' }]);

      if (!dealer_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'dealer_id is required in query parameters' 
        });
      }

      const result = await dealerDataService.getDealerData(models, dealer_id);

      // Logging response summary
      console.table([{
        dealer_id,
        dealer_name: result.dealer_info?.name || 'N/A',
        total_clients: result.summary?.total_clients || 0,
        total_vehicles: result.summary?.total_vehicles || 0,
        total_rto_records: result.summary?.total_rto_records || 0,
        total_challan_records: result.summary?.total_challan_records || 0,
        success: result.success
      }]);

      return res.json(result);

    } catch (error) {
      console.error('Error in /dealerdata:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  return router;
};