const dealerService = require('../services/dealerService');

exports.getAllDealers = async (req, res) => {
  console.log('Fetching all dealers for admin_id:', req.query.admin_id);
  try {
    const admin_id = req.query.admin_id;
    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' });
    }
    const result = await dealerService.getAllDealers(admin_id);
    console.table(result.dealers);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


