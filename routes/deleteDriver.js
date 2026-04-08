const express = require('express');
const router = express.Router();

module.exports = (models) => {
  // DELETE (soft): PATCH /deletedriver/:id
  router.patch('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const client_id = req.query.client_id || req.body.client_id;

      if (!client_id) return res.status(400).json({ error: 'client_id is required' });

      const record = await models.DiDriverData.findOne({ where: { id, client_id } });
      if (!record) return res.status(404).json({ error: 'Record not found' });

      await record.update({ status: 'deleted' });
      return res.json({ message: 'deleted', id: record.id });
    } catch (err) {
      console.error('Error deleting driver record:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};
