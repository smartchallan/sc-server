// jobs/dailyChallanNotifyJob.js
// Daily Challan Notification Job
// 1. Fetch all active client users
// 2. Fetch challans updated yesterday
// 3. Filter pending challans for yesterday
// 4. Group by client, prepare table, send email
// 5. Schedule job at configurable time

const { User, VehicleChallan, UserVehicle } = require('../models');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const moment = require('moment');
const config = require('../config/config');

async function dailyChallanNotifyJob() {
	try {
		// Query di_user for active clients
		const clients = await User.findAll({
			where: { status: 'active', role: 'client' },
			attributes: ['id', 'name', 'email'],
			raw: true
		});
		console.table(clients);
		return clients;
	} catch (err) {
		console.error('Error fetching clients in dailyChallanNotifyJob:', err);
		throw err;
	}
}

module.exports = dailyChallanNotifyJob;
