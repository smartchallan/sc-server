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
