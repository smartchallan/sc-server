const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

function flattenNetworkIds(nodes) {
  const ids = [];
  for (const node of nodes) {
    ids.push(parseInt(node.id));
    if (node.children && node.children.length > 0) {
      ids.push(...flattenNetworkIds(node.children));
    }
  }
  return ids;
}

module.exports = (models) => {
  const { User, UserMeta, VehicleRTOData, VehicleChallan } = models;

  // GET /master-search?query=X&dealer_id=Y
  router.get('/', async (req, res) => {
    try {
      const { query, dealer_id } = req.query;
      if (!query || !dealer_id) {
        return res.status(400).json({ error: 'query and dealer_id are required' });
      }
      const q = String(query).trim();
      if (q.length < 2) {
        return res.json({ vehicles: [], challans: [], clients: [] });
      }

      // Get all client IDs in dealer's network (recursive)
      const clientService = require('../services/clientService');
      const network = await clientService.getClientNetwork(dealer_id);
      const clientIds = flattenNetworkIds(network);

      if (clientIds.length === 0) {
        return res.json({ vehicles: [], challans: [], clients: [] });
      }

      const likeQuery = `%${q}%`;

      // Search vehicles by vehicle_number
      const vehicles = await VehicleRTOData.findAll({
        where: {
          vehicle_number: { [Op.like]: likeQuery },
          client_id: { [Op.in]: clientIds }
        },
        attributes: ['id', 'vehicle_number', 'client_id', 'insurance_exp', 'fitness_exp'],
        limit: 8,
        raw: true
      });

      // Search challans by vehicle_number
      const challans = await VehicleChallan.findAll({
        where: {
          vehicle_number: { [Op.like]: likeQuery },
          client_id: { [Op.in]: clientIds }
        },
        attributes: ['id', 'vehicle_number', 'client_id'],
        limit: 8,
        raw: true
      });

      // Search clients by name or email
      const clientMatches = await User.findAll({
        where: {
          id: { [Op.in]: clientIds },
          [Op.or]: [
            { name: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } }
          ]
        },
        attributes: ['id', 'name', 'email', 'status'],
        limit: 8,
        raw: true
      });

      // Also search UserMeta by company_name
      const metaByCompany = await UserMeta.findAll({
        where: {
          user_id: { [Op.in]: clientIds },
          company_name: { [Op.like]: likeQuery }
        },
        attributes: ['user_id', 'company_name', 'phone'],
        raw: true
      });

      // Merge: extra clients found via company_name search
      const existingClientIdSet = new Set(clientMatches.map(c => c.id));
      const extraClientIds = metaByCompany
        .map(m => m.user_id)
        .filter(id => !existingClientIdSet.has(id));
      let extraClients = [];
      if (extraClientIds.length > 0) {
        extraClients = await User.findAll({
          where: { id: { [Op.in]: extraClientIds } },
          attributes: ['id', 'name', 'email', 'status'],
          limit: 8,
          raw: true
        });
      }

      // Build meta map for all matched clients
      const allMatchedClients = [...clientMatches, ...extraClients].slice(0, 8);
      const allMatchedIds = allMatchedClients.map(c => c.id);
      let metaMap = {};
      if (allMatchedIds.length > 0) {
        const metas = await UserMeta.findAll({
          where: { user_id: { [Op.in]: allMatchedIds } },
          attributes: ['user_id', 'company_name', 'phone'],
          raw: true
        });
        for (const m of metas) metaMap[m.user_id] = m;
      }
      // Also include metas from company_name search
      for (const m of metaByCompany) {
        if (!metaMap[m.user_id]) metaMap[m.user_id] = m;
      }

      // Build client name map for vehicle/challan enrichment
      const enrichIds = [
        ...new Set([
          ...vehicles.map(v => v.client_id),
          ...challans.map(c => c.client_id)
        ])
      ];
      const clientNameMap = {};
      if (enrichIds.length > 0) {
        const enrichUsers = await User.findAll({
          where: { id: { [Op.in]: enrichIds } },
          attributes: ['id', 'name'],
          raw: true
        });
        for (const c of enrichUsers) clientNameMap[c.id] = c.name;
      }

      res.json({
        vehicles: vehicles.map(v => ({ ...v, client_name: clientNameMap[v.client_id] || '' })),
        challans: challans.map(c => ({ ...c, client_name: clientNameMap[c.client_id] || '' })),
        clients: allMatchedClients.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          status: c.status,
          company_name: metaMap[c.id]?.company_name || '',
          phone: metaMap[c.id]?.phone || ''
        }))
      });
    } catch (err) {
      console.error('Master search error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
