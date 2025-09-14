const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const { User, UserVehicle } = models;

  // GET /clientdata/:client_id
  router.get('/:client_id', async (req, res) => {
    const { client_id } = req.params;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }
    try {
      // Fetch all vehicles registered to this client
      const vehicles = await UserVehicle.findAll({
        where: { client_id }
      });
      console.table([{ client_id, vehicles: vehicles.length }]);
      res.json({ client_id, vehicles });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch client data' });
    }
  });

  return router;
};
