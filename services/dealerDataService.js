const { Op } = require('sequelize');

async function getDealerData(models, dealer_id) {
  const { User, UserBilling, UserMeta, UserVehicle, VehicleRTOData, VehicleChallan } = models;

  if (!dealer_id) {
    throw new Error('dealer_id is required');
  }

  try {
    // First, get dealer information
    const dealer = await User.findOne({
      where: { 
        id: dealer_id,
        role: 'dealer'
      },
      include: [
        {
          model: UserMeta,
          required: false,
          as: 'meta'
        }
      ]
    });

    if (!dealer) {
      throw new Error('Dealer not found');
    }

    // Get all clients for the dealer with their billing and meta data
    const clients = await User.findAll({
      where: {
        dealer_id: dealer_id,
        role: 'client'
      },
      include: [
        {
          model: UserBilling,
          required: false,
          as: 'billing'
        },
        {
          model: UserMeta,
          required: false,
          as: 'meta'
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Get client IDs for additional queries
    const clientIds = clients.map(client => client.id);

    // Get vehicle counts for each client
    const vehicleCounts = clientIds.length > 0 ? await UserVehicle.findAll({
      attributes: [
        'client_id',
        [UserVehicle.sequelize.fn('COUNT', UserVehicle.sequelize.col('id')), 'vehicle_count']
      ],
      where: {
        client_id: { [Op.in]: clientIds }
      },
      group: ['client_id'],
      raw: true
    }) : [];

    // Get RTO record counts for each client
    const rtoRecordCounts = clientIds.length > 0 ? await VehicleRTOData.findAll({
      attributes: [
        'client_id',
        [VehicleRTOData.sequelize.fn('COUNT', VehicleRTOData.sequelize.col('id')), 'rto_count']
      ],
      where: {
        client_id: { [Op.in]: clientIds }
      },
      group: ['client_id'],
      raw: true
    }) : [];

    // Get challan record counts for each client
    const challanRecordCounts = clientIds.length > 0 ? await VehicleChallan.findAll({
      attributes: [
        'client_id',
        [VehicleChallan.sequelize.fn('COUNT', VehicleChallan.sequelize.col('id')), 'challan_count']
      ],
      where: {
        client_id: { [Op.in]: clientIds }
      },
      group: ['client_id'],
      raw: true
    }) : [];

    // Combine all data for each client
    const enrichedClients = clients.map(client => {
      const vehicleData = vehicleCounts.find(vc => vc.client_id === client.id) || { vehicle_count: 0 };
      const rtoData = rtoRecordCounts.find(rc => rc.client_id === client.id) || { rto_count: 0 };
      const challanData = challanRecordCounts.find(cc => cc.client_id === client.id) || { challan_count: 0 };

      return {
        ...client.toJSON(),
        statistics: {
          vehicles_registered: parseInt(vehicleData.vehicle_count) || 0,
          rto_records: parseInt(rtoData.rto_count) || 0,
          challan_records: parseInt(challanData.challan_count) || 0
        }
      };
    });

    // Calculate totals
    const totalVehicles = enrichedClients.reduce((sum, client) => sum + client.statistics.vehicles_registered, 0);
    const totalRtoRecords = enrichedClients.reduce((sum, client) => sum + client.statistics.rto_records, 0);
    const totalChallanRecords = enrichedClients.reduce((sum, client) => sum + client.statistics.challan_records, 0);

    return {
      success: true,
      message: `Found ${clients.length} clients for dealer ${dealer_id}`,
      dealer_info: {
        id: dealer.id,
        name: dealer.name,
        email: dealer.email,
        mobile: dealer.mobile,
        role: dealer.role,
        admin_id: dealer.admin_id,
        meta: dealer.meta
      },
      summary: {
        total_clients: clients.length,
        total_vehicles: totalVehicles,
        total_rto_records: totalRtoRecords,
        total_challan_records: totalChallanRecords
      },
      clients: enrichedClients
    };

  } catch (error) {
    console.error('Error in getDealerData:', error);
    throw new Error(`Failed to fetch dealer data: ${error.message}`);
  }
}

module.exports = {
  getDealerData
};