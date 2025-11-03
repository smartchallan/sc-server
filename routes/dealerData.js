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

      // Logging response
      console.table([{
        dealer_id,
        clients_found: result.data ? result.data.length : 0,
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