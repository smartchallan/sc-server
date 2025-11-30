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
  // ...existing code...
  // Helper to check if array field is non-empty
  function hasNonEmptyArrayField(field) {
    if (!field) return false;
    if (typeof field === 'string') {
      try { field = JSON.parse(field); } catch { return false; }
    }
    return Array.isArray(field) && field.length > 0;
  }

  // ...existing code...
  try {
    // 1. Fetch all users from users table where role is client and status is active
    const clients = await User.findAll({
      where: {
        role: 'client',
        status: 'active'
      },
      raw: true
    });
    // console.table(clients);

    // 2. Fetch records from challan table which got updated yesterday (IST, but DB is UTC)
    const momentTz = require('moment-timezone');
        // ...existing code...
  // Corrected: todayIST is start of today, yesterdayIST is start of yesterday, twoDaysBackIST is start of 2 days ago (Asia/Kolkata)
  // Make lookback days configurable via env
  const lookbackDays = parseInt(process.env.CHALLAN_LOOKBACK_DAYS, 10) || 1;
  const todayIST = momentTz().tz('Asia/Kolkata').startOf('day');
  const startIST = todayIST.clone().subtract(lookbackDays, 'days');
  const endIST = todayIST;
  const startUTC = startIST.clone().utc();
  const endUTC = endIST.clone().utc();

  // Print the configured range
  const startDateStr = startIST.format('YYYY-MM-DD');
  const endDateStr = endIST.clone().subtract(1, 'seconds').format('YYYY-MM-DD');
  const startTime = startIST.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const endTime = endIST.clone().subtract(1, 'seconds').endOf('day').format('YYYY-MM-DD HH:mm:ss');
  console.log(`Challan lookback days: ${lookbackDays}`);
  console.log(`Start date: ${startDateStr}`);
  console.log(`End date: ${endDateStr}`);
  console.log(`Start time: ${startTime}`);
  console.log(`End time: ${endTime}`);

  // For every client and every vehicle registered under that client, fetch challans for yesterday
  const allClients = await User.findAll({ where: { role: 'client' }, raw: true });
  const challansForYesterday = [];
  for (const client of allClients) {
  const vehicles = await UserVehicle.findAll({ where: { client_id: client.id }, raw: true });
  console.log('date check', startUTC.toDate(), endUTC.toDate());
  // break;   
    for (const vehicle of vehicles) {
      // Fetch challans for this vehicle updated yesterday
      const challans = await VehicleChallan.findAll({
        where: {
          vehicle_number: vehicle.vehicle_number,
          updated_at: {
            // [Op.gte]: startUTC.toDate(),
            // [Op.lt]: endUTC.toDate()
            [Op.gte]: startTime,
            [Op.lt]: endTime
          }
        },
        raw: true
      });
      console.log('Challans found for vehicle:', vehicle.vehicle_number, 'Count:', challans.length);
      challans.forEach(challan => {
        // Only include if any pending_data or disposed_data item has challan_date_time in the lookback range
        // Pending challans
        let pendingDataArr = challan.pending_data;
        if (typeof pendingDataArr === 'string') {
          try {
            pendingDataArr = JSON.parse(pendingDataArr);
          } catch (e) {
            pendingDataArr = [];
          }
        }
        if (Array.isArray(pendingDataArr)) {
          pendingDataArr.forEach(item => {
            if (item.challan_date_time) {
              const itemDate = momentTz(item.challan_date_time, 'DD-MM-YYYY HH:mm:ss').tz('Asia/Kolkata');
              if (itemDate.isSameOrAfter(startIST, 'day') && itemDate.isBefore(endIST, 'day')) {
                challansForYesterday.push({
                  client_id: client.id,
                  client_name: client.name || client.full_name || client.username || '',
                  vehicle_number: challan.vehicle_number,
                  challan_no: item.challan_no || challan.challan_no || '',
                  status: 'pending',
                  amount: item.amount || challan.amount || '',
                  challan_issued_at: item.challan_date_time,
                  challan_paid_at: ''
                });
              }
            }
          });
        }
        // Disposed challans
        let disposedDataArr = challan.disposed_data;
        if (typeof disposedDataArr === 'string') {
          try {
            disposedDataArr = JSON.parse(disposedDataArr);
          } catch (e) {
            disposedDataArr = [];
          }
        }
        if (Array.isArray(disposedDataArr)) {
          disposedDataArr.forEach(item => {
            if (item.challan_date_time) {
              const itemDate = momentTz(item.challan_date_time, 'DD-MM-YYYY HH:mm:ss').tz('Asia/Kolkata');
              if (itemDate.isSameOrAfter(startIST, 'day') && itemDate.isBefore(endIST, 'day')) {
                challansForYesterday.push({
                  client_id: client.id,
                  client_name: client.name || client.full_name || client.username || '',
                  vehicle_number: challan.vehicle_number,
                  challan_no: item.challan_no || challan.challan_no || '',
                  status: 'disposed',
                  amount: item.amount || challan.amount || '',
                  challan_issued_at: item.challan_date_time,
                  challan_paid_at: item.paid_at || item.disposed_at || ''
                });
              }
            }
          });
        }
        // If neither pending nor disposed data has challan_date_time in yesterday, do not include
      });
    }
  }

    // 3. Print all challans for yesterday (already done above)
    // 4. Skipped grouping and table generation for clients
    // 5. Only send a summary email to smartchallan@gmail.com
    const logoUrl = process.env.COMPANY_LOGO_URL || '';
    const subject = `Challan Summary for ${startIST.format('YYYY-MM-DD')} to ${endIST.clone().subtract(1, 'days').format('YYYY-MM-DD')}`;
    let html = `<div style=\"font-family:Arial,sans-serif;max-width:900px;margin:auto;background:#f9f9f9;padding:24px;border-radius:8px;\">
      <div style=\"text-align:center;margin-bottom:24px;\">
        <img src=\"${logoUrl}\" alt=\"Company Logo\" style=\"max-width:180px;max-height:80px;\"/>
      </div>
      <h2 style=\"color:#2d3748;text-align:center;\">Challan Summary for ${startIST.format('YYYY-MM-DD')} to ${endIST.clone().subtract(1, 'days').format('YYYY-MM-DD')}</h2>
      <p style=\"font-size:15px;\">Total challans found: <b>${challansForYesterday.length}</b></p>`;
    if (challansForYesterday.length > 0) {
      html += `<div style="margin:24px 0;overflow-x:auto;"><table border="1" cellpadding="6" style="border-collapse:collapse;"><thead><tr><th>Client ID</th><th>Client Name</th><th>Vehicle No</th><th>Challan No</th><th>Status</th><th>Amount</th><th>Issued At</th><th>Paid At</th></tr></thead><tbody>`;
      challansForYesterday.forEach(row => {
        html += `<tr><td>${row.client_id}</td><td>${row.client_name}</td><td>${row.vehicle_number}</td><td>${row.challan_no}</td><td>${row.status}</td><td>${row.amount}</td><td>${row.challan_issued_at}</td><td>${row.challan_paid_at}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
      html += `<p style="margin-top:32px;font-size:14px;color:#718096;">This is an automated notification from smartchallan.</p></div>`;
      await emailService.sendMail({
        to: 'smartchallan@gmail.com',
        subject,
        html
      });
  } catch (err) {
    console.error('Error in dailyChallanNotifyJob:', err);
  }
}

// Scheduling logic will be added later

module.exports = dailyChallanNotifyJob;
