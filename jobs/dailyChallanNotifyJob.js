// jobs/dailyChallanNotifyJob.js
// Daily Challan Notification Job
// 1. Fetch all active client users
// 2. Fetch challans updated yesterday
// 3. Filter pending challans for yesterday
// 4. Group by client, prepare table, send email
// 5. Schedule job at configurable time

const { User, VehicleChallan, UserVehicles } = require('../models');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const moment = require('moment');
const config = require('../config/config');

async function dailyChallanNotifyJob() {
  try {
    // 1. Fetch all users from users table where role is client and status is active
    const clients = await User.findAll({
      where: {
        role: 'client',
        status: 'active'
      },
      raw: true
    });
    console.table(clients);
    // 2. Fetch records from challan table which got updated yesterday
    const yesterday = moment().subtract(1, 'days').startOf('day');
    const today = moment().startOf('day');
  const challans = await VehicleChallan.findAll({
      where: {
        updated_at: {
          [Op.gte]: yesterday.toDate(),
          [Op.lt]: today.toDate()
        }
      },
      raw: true
    });
    console.table(challans);

    // 3. From challan record array - fetch challans which are in pending state and date is yesterday's date
    const pendingChallans = challans.filter(challan => {
      // pending_data is JSON, check if it exists and has at least one entry with date as yesterday
      if (!challan.pending_data || !Array.isArray(challan.pending_data)) return false;
      return challan.pending_data.some(item => {
        // item.date should match yesterday (format: YYYY-MM-DD)
        const itemDate = moment(item.date).startOf('day');
        return item.status === 'pending' && itemDate.isSame(yesterday, 'day');
      });
    });
    console.table(pendingChallans);

    // 4. Group by client and vehicle, prepare table for each client
    const clientChallanMap = {};
    for (const client of clients) {
      clientChallanMap[client.id] = [];
    }
    for (const challan of pendingChallans) {
      if (clientChallanMap[challan.client_id]) {
        // For each pending challan, extract vehicle number and pending challan details for yesterday
        const vehicleNumber = challan.vehicle_number;
        const pendingForYesterday = (challan.pending_data || []).filter(item => {
          const itemDate = moment(item.date).startOf('day');
          return item.status === 'pending' && itemDate.isSame(yesterday, 'day');
        });
        for (const item of pendingForYesterday) {
          clientChallanMap[challan.client_id].push({
            vehicle_number: vehicleNumber,
            challan: item
          });
        }
      }
    }
    // Prepare HTML tables for each client
    const clientTables = {};
    for (const client of clients) {
      const challanRows = clientChallanMap[client.id].map(row =>
        `<tr><td>${row.vehicle_number}</td><td>${row.challan.challan_no || ''}</td><td>${row.challan.amount || ''}</td><td>${row.challan.date || ''}</td><td>${row.challan.status || ''}</td></tr>`
      ).join('');
      clientTables[client.id] = challanRows
        ? `<table border="1" cellpadding="6" style="border-collapse:collapse;"><thead><tr><th>Vehicle Number</th><th>Challan No</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${challanRows}</tbody></table>`
        : '';
    }

    // 5. Send email to each client and to smartchallan@gmail.com
    for (const client of clients) {
      const email = client.email;
      const name = client.name;
      const tableHtml = clientTables[client.id];
      let html, subject;
      if (tableHtml) {
        subject = `Pending Challans for Your Fleet - ${moment(yesterday).format('YYYY-MM-DD')}`;
        html = `<p>Dear ${name},</p><p>Please find below the list of pending challans for your fleet updated on ${moment(yesterday).format('YYYY-MM-DD')}:</p>${tableHtml}`;
      } else {
        subject = `No Challan Issued for Your Fleet - ${moment(yesterday).format('YYYY-MM-DD')}`;
        html = `<p>Dear ${name},</p><p>No challan issued against any vehicle in your fleet. It's time to sit back and relax.</p>`;
      }
      // Send to client
      await emailService.sendMail({
        to: email,
        subject,
        html
      });
      // Send to smartchallan@gmail.com as well
      await emailService.sendMail({
        to: 'smartchallan@gmail.com',
        subject: `[Client: ${name} | ${email}] ` + subject,
        html
      });
    }
  } catch (err) {
    console.error('Error in dailyChallanNotifyJob:', err);
  }
}

// Scheduling logic will be added later

module.exports = dailyChallanNotifyJob;
