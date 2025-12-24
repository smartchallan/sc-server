const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const { User, UserVehicle, UserOptions } = models;

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

      // Find the user_id for this client_id
      const user = await models.User.findOne({ where: { client_id } });
      let user_options = {};
      if (user) {
        // Fetch options for this user_id
        const options = await UserOptions.findAll({ where: { user_id: user.id } });
        user_options = {};
        for (const opt of options) {
          // Convert option_value to boolean if possible
          let val = opt.option_value;
          if (typeof val === 'string') {
            if (val.toLowerCase() === 'true' || val === '1') val = true;
            else if (val.toLowerCase() === 'false' || val === '0') val = false;
          }
          user_options[opt.option_key] = typeof val === 'boolean' ? val : !!val;
        }
      }
      console.table([{ client_id, vehicles: vehicles.length, user_options_count: Object.keys(user_options).length }]);
      res.json({ client_id, vehicles, user_options });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch client data' });
    }
  });

  return router;
};
