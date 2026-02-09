const clientService = require('../services/clientService');

exports.getAllClients = async (req, res) => {
  try {
    const clients = await clientService.getAllClients();
    console.table(clients);
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClientsByDealer = async (req, res) => {
  try {
    const clients = await clientService.getClientsByDealer(req.params.dealer_id);
    console.table(clients);
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.registerClient = async (req, res) => {
  try {
    const client = await clientService.registerClient(req.body);
    console.table(client);
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClientNetwork = async (req, res) => {
  try {
    // Prefer authenticated user id if available, otherwise accept parent_id via query/body
    const parentId = (req.user && req.user.id) || req.query.parent_id || req.body.parent_id;
    if (!parentId) return res.status(400).json({ error: 'parent_id is required (or authenticate to provide it).' });

    const network = await clientService.getClientNetwork(parentId);
    res.json(network);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
