const service = require('../services/clientService');

exports.getClientNetwork = async (req, res) => {
  try {
    console.log('Received request for getClientNetwork with query:', req.query, 'and body:', req.body);
    // Prefer explicit parent_id (query or body) if provided, otherwise fall back to authenticated user id
    const parentId = req.query.parent_id || req.body.parent_id || (req.user && req.user.id);
    if (!parentId) return res.status(400).json({ error: 'parent_id is required (or authenticate to provide it).' });

    const network = await service.getClientNetwork(parentId);
    res.json(network);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
