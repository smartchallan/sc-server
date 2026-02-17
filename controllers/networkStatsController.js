const { User, UserVehicle } = require('../models');

// Helper to recursively fetch all clients under a parent id
async function fetchAllClients(parentId, allClients = []) {
  // Find direct children
  const children = await User.findAll({
    where: { parent_id: parentId },
    attributes: ['id', 'status', 'parent_id']
  });
  for (const child of children) {
    allClients.push(child);
    // Recursively fetch children of this child
    await fetchAllClients(child.id, allClients);
  }
  return allClients;
}

// GET /getnetworkstats?id=123
exports.getNetworkStats = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    // Recursively fetch all clients under this id
    const allClients = await fetchAllClients(id);
    console.log(`Total clients under id ${id}:`, allClients.length);
    console.table(allClients.map(c => ({ id: c.id, status: c.status, parent_id: c.parent_id })));
    const hasNetwork = allClients.length > 0;
    const statusCount = allClients.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1;
      return acc;
    }, {});

    // Find vehicles where parent_id = id or parent_id in allClients
    const allClientIds = allClients.map(c => c.id);
    allClientIds.push(Number(id)); // include the root id

    const vehicles = await UserVehicle.findAll({
      where: {
        parent_id: allClientIds
      },
      attributes: ['id', 'status']
    });
    const totalVehicles = vehicles.length;
    const vehicleStatus = vehicles.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    const result = {
      hasNetwork,
      totalClients: allClients.length,
      clientStatus: statusCount,
      totalVehicles,
      vehicleStatus
    };

    console.table(result);
    return res.json(result);
  } catch (err) {
    console.error('Error in /getnetworkstats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
