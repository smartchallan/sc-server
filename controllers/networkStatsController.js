const { User, UserVehicle, DiVehicleChallanJob, VehicleChallan } = require('../models');

// Helper to recursively fetch all clients under a parent id
async function fetchAllClients(parentId, allClients = []) {
  const children = await User.findAll({
    where: { parent_id: parentId },
    attributes: ['id', 'status', 'parent_id']
  });
  for (const child of children) {
    allClients.push(child);
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

    const allClients = await fetchAllClients(id);
    console.log(`Total clients under id ${id}:`, allClients.length);
    const hasNetwork = allClients.length > 0;
    const statusCount = allClients.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1;
      return acc;
    }, {});

    const allClientIds = allClients.map(c => c.id);
    allClientIds.push(Number(id));

    const vehicles = await UserVehicle.findAll({
      where: { client_id: allClientIds },
      attributes: ['id', 'status', 'client_id', 'vehicle_number']
    });
    const totalVehicles = vehicles.length;
    const vehicleStatus = vehicles.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    const vehicleNumbers = vehicles.map(v => v.vehicle_number).filter(Boolean);

    // Query di_vehicle_challan_job first (batch-fetched, one row per challan)
    const jobChallans = vehicleNumbers.length > 0
      ? await DiVehicleChallanJob.findAll({
          where: { vehicle_number: vehicleNumbers },
          attributes: ['vehicle_number', 'fine_imposed', 'fine_paid', 'challan_status']
        })
      : [];

    // For vehicles absent from di_vehicle_challan_job, fall back to di_vehicle_challans
    // (single-vehicle endpoint saves raw JSON pending_data/disposed_data there).
    // Querying only uncovered vehicles avoids double-counting.
    const vehiclesInJobTable = new Set(jobChallans.map(c => c.vehicle_number));
    const vehiclesOnlyInRawTable = vehicleNumbers.filter(vn => !vehiclesInJobTable.has(vn));

    const rawChallanRecords = vehiclesOnlyInRawTable.length > 0
      ? await VehicleChallan.findAll({
          where: { vehicle_number: vehiclesOnlyInRawTable },
          attributes: ['vehicle_number', 'pending_data', 'disposed_data']
        })
      : [];

    // Flatten raw JSON records into the same shape as jobChallans
    const rawChallans = [];
    for (const record of rawChallanRecords) {
      const pending = Array.isArray(record.pending_data) ? record.pending_data : [];
      const disposed = Array.isArray(record.disposed_data) ? record.disposed_data : [];
      for (const item of pending) {
        rawChallans.push({
          fine_imposed: parseFloat(item.fine_imposed || item.fine_amount || item.penalty_amount) || 0,
          fine_paid: 0,
          challan_status: 'pending'
        });
      }
      for (const item of disposed) {
        rawChallans.push({
          fine_imposed: parseFloat(item.fine_imposed || item.fine_amount || item.penalty_amount) || 0,
          fine_paid: parseFloat(item.received_amount || item.amount_paid || item.paid_amount) || 0,
          challan_status: 'disposed'
        });
      }
    }

    const challans = [...jobChallans, ...rawChallans];

    const challanStats = challans.reduce((acc, challan) => {
      const imposed = parseFloat(challan.fine_imposed) || 0;
      const paid = parseFloat(challan.fine_paid) || 0;
      acc.total += imposed;
      acc.paid += paid;
      const status = challan.challan_status;
      if (status) {
        acc.statusCount[status] = (acc.statusCount[status] || 0) + 1;
      }
      return acc;
    }, { total: 0, paid: 0, statusCount: {} });

    challanStats.pending = challanStats.total - challanStats.paid;

    const result = {
      hasNetwork,
      totalClients: allClients.length,
      clientStatus: statusCount,
      totalVehicles,
      vehicleStatus,
      totalChallans: challans.length,
      challanStatus: challanStats.statusCount,
      challanAmount: {
        total: parseFloat(challanStats.total.toFixed(2)),
        paid: parseFloat(challanStats.paid.toFixed(2)),
        pending: parseFloat(challanStats.pending.toFixed(2))
      }
    };

    return res.json(result);
  } catch (err) {
    console.error('Error in /getnetworkstats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
