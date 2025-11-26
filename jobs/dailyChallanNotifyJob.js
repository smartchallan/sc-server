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
  // Helper to check if array field is non-empty
  function hasNonEmptyArrayField(field) {
    if (!field) return false;
    if (typeof field === 'string') {
      try { field = JSON.parse(field); } catch { return false; }
    }
    return Array.isArray(field) && field.length > 0;
  }

        // ...existing code...
        // DEBUG: Print pending_data for challan with updated_at '2025-11-25 19:52:14' IST or UTC
        const targetUpdatedAtIST = '2025-11-25 19:52:14';
        const targetUpdatedAtUTC = new Date('2025-11-25T14:22:14Z').toISOString();
        const challansByUpdatedAt = await VehicleChallan.findAll({
          where: {
            updated_at: {
              [Op.gte]: new Date('2025-11-25T00:00:00+05:30'),
              [Op.lt]: new Date('2025-11-26T00:00:00+05:30')
            },
            client_id: 20,
            vehicle_number: 'JH09AZ4122'
          },
          raw: true
        });
        console.log('--- CHALLANS WITH updated_at on 2025-11-25 IST ---');
        challansByUpdatedAt.forEach(challan => {
          let pendingDataArr = challan.pending_data;
          if (typeof pendingDataArr === 'string') {
            try {
              pendingDataArr = JSON.parse(pendingDataArr);
            } catch (e) {
              pendingDataArr = [];
            }
          }
          console.log(`Challan ID: ${challan.id}, updated_at: ${challan.updated_at}`);
          if (Array.isArray(pendingDataArr)) {
            pendingDataArr.forEach((item, idx) => {
              console.log(`  [${idx}] challan_date_time: ${item.challan_date_time}`);
              console.log(`  [${idx}] full object:`, JSON.stringify(item, null, 2));
            });
          } else {
            console.log('  No pending_data array');
          }
        });
        console.log('--- END CHALLANS WITH updated_at on 2025-11-25 IST ---');
    // ...existing code...
    // ...existing code...
    // ...existing code...
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
    console.table(clients);

    // 2. Fetch records from challan table which got updated yesterday (IST, but DB is UTC)
    const momentTz = require('moment-timezone');
        // DEBUG: Log pending_data for challans where updated_at > 2 days ago (IST start of day)
        const twoDaysAgoIST = momentTz().tz('Asia/Kolkata').subtract(2, 'days').startOf('day');
        const twoDaysAgoUTC = twoDaysAgoIST.clone().utc();
        // Only for challan id 419: print challan_date_time from pending_data and disposed_data
        const challan419 = await VehicleChallan.findOne({
          where: { id: 419 },
          raw: true
        });
        if (challan419) {
          function printChallanDateTimes(arr, label) {
            if (typeof arr === 'string') {
              try {
                arr = JSON.parse(arr);
              } catch (e) {
                arr = [];
              }
            }
            if (Array.isArray(arr)) {
              arr.forEach((item, idx) => {
                if (item.challan_date_time) {
                  console.log(`${label}[${idx}]: ${item.challan_date_time}`);
                }
              });
            }
          }
          console.log('--- challan id 419: pending_data challan_date_time ---');
          printChallanDateTimes(challan419.pending_data, 'pending_data');
          console.log('--- challan id 419: disposed_data challan_date_time ---');
          printChallanDateTimes(challan419.disposed_data, 'disposed_data');
        } else {
          console.log('Challan id 419 not found');
        }
  // Corrected: todayIST is start of today, yesterdayIST is start of yesterday, twoDaysBackIST is start of 2 days ago (Asia/Kolkata)
  const todayIST = momentTz().tz('Asia/Kolkata').startOf('day');
  const yesterdayIST = todayIST.clone().subtract(1, 'days');
  const twoDaysBackIST = todayIST.clone().subtract(2, 'days');
  const yesterdayUTC = yesterdayIST.clone().utc();
  const todayUTC = todayIST.clone().utc();
  const twoDaysBackUTC = twoDaysBackIST.clone().utc();

  // Fetch and print all challans for client_id 20 updated today (IST)
  const challansTodayClient20 = await VehicleChallan.findAll({
    where: {
      client_id: 20,
      updated_at: {
        [Op.gte]: todayUTC.toDate(),
        [Op.lt]: moment(todayUTC).add(1, 'days').toDate()
      }
    },
    raw: true
  });
  const challansTodayWithData = challansTodayClient20.filter(
    c => hasNonEmptyArrayField(c.pending_data) || hasNonEmptyArrayField(c.disposed_data)
  );
  console.log('--- CHALLANS FOR client_id 20 UPDATED TODAY (IST) WITH PENDING OR DISPOSED DATA ---');
  challansTodayWithData.forEach(challan => {
    console.log(`Challan ID: ${challan.id}, updated_at: ${challan.updated_at}`);
  });
  console.log('Total challans updated today for client_id 20 (pending/disposed):', challansTodayWithData.length);

  const challansYesterdayClient20 = await VehicleChallan.findAll({
    where: {
      client_id: 20,
      updated_at: {
        [Op.gte]: yesterdayUTC.toDate(),
        [Op.lt]: todayUTC.toDate()
      }
    },
    raw: true
  });
  const challansYesterdayWithData = challansYesterdayClient20.filter(
    c => hasNonEmptyArrayField(c.pending_data) || hasNonEmptyArrayField(c.disposed_data)
  );
  console.log('--- CHALLANS FOR client_id 20 UPDATED YESTERDAY (IST) WITH PENDING OR DISPOSED DATA ---');
  challansYesterdayWithData.forEach(challan => {
    console.log(`Challan ID: ${challan.id}, updated_at: ${challan.updated_at}`);
  });
  console.log('Total challans updated yesterday for client_id 20 (pending/disposed):', challansYesterdayWithData.length);
  // Count challans updated yesterday for client_id 20
  const challansUpdatedYesterdayClient20 = await VehicleChallan.count({
    where: {
      client_id: 20,
      updated_at: {
        [Op.gte]: yesterdayUTC.toDate(),
        [Op.lt]: todayUTC.toDate()
      }
    }
  });
  console.log(`Challans updated yesterday for client_id 20: ${challansUpdatedYesterdayClient20}`);
        // DEBUG: Fetch all challans for client_id 20 and vehicle_number 'JH09AZ4122', print updated_at and pending_data, and check if updated_at is in yesterday IST window
        const allChallansClient20 = await VehicleChallan.findAll({
          where: {
            client_id: 20,
            vehicle_number: 'JH09AZ4122'
          },
          raw: true
        });
        console.log('--- ALL CHALLANS FOR client_id 20, vehicle_number JH09AZ4122 ---');
        allChallansClient20.forEach(challan => {
          const updatedAt = new Date(challan.updated_at);
          const inYesterdayWindow = updatedAt >= yesterdayUTC.toDate() && updatedAt < todayUTC.toDate();
          let pendingDataArr = challan.pending_data;
          if (typeof pendingDataArr === 'string') {
            try {
              pendingDataArr = JSON.parse(pendingDataArr);
            } catch (e) {
              pendingDataArr = [];
            }
          }
          console.log(`Challan ID: ${challan.id}, updated_at: ${challan.updated_at}, inYesterdayWindow: ${inYesterdayWindow}`);
          if (Array.isArray(pendingDataArr)) {
            pendingDataArr.forEach((item, idx) => {
              console.log(`  [${idx}]`, JSON.stringify(item, null, 2));
            });
          } else {
            console.log('  No pending_data array');
          }
        });
        console.log('--- END ALL CHALLANS FOR client_id 20, vehicle_number JH09AZ4122 ---');
      const challans = await VehicleChallan.findAll({
        where: {
          updated_at: {
            [Op.gte]: yesterdayUTC.toDate(),
            [Op.lt]: todayUTC.toDate()
          }
        },
        raw: true
      });
        // DEBUG: Print all pending_data challans for client_id 20
        const challansClient20 = challans.filter(challan => challan.client_id === 20);
        console.log('--- PENDING_DATA FOR client_id 20 ---');
        challansClient20.forEach(challan => {
          let pendingDataArr = challan.pending_data;
          if (typeof pendingDataArr === 'string') {
            try {
              pendingDataArr = JSON.parse(pendingDataArr);
            } catch (e) {
              pendingDataArr = [];
            }
          }
          console.log(`Challan ID: ${challan.id}, updated_at: ${challan.updated_at}`);
          if (Array.isArray(pendingDataArr)) {
            pendingDataArr.forEach((item, idx) => {
              console.log(`  [${idx}]`, JSON.stringify(item, null, 2));
            });
          } else {
            console.log('  No pending_data array');
          }
        });
        console.log('--- END PENDING_DATA FOR client_id 20 ---');
  console.log('IST 2 days back:', twoDaysBackIST.format('YYYY-MM-DD HH:mm:ss'));
  console.log('IST yesterday:', yesterdayIST.format('YYYY-MM-DD HH:mm:ss'));
  console.log('IST today:', todayIST.format('YYYY-MM-DD HH:mm:ss'));
  console.log('UTC 2 days back:', twoDaysBackUTC.format('YYYY-MM-DD HH:mm:ss'));
  console.log('UTC yesterday:', yesterdayUTC.format('YYYY-MM-DD HH:mm:ss'));
  console.log('UTC today:', todayUTC.format('YYYY-MM-DD HH:mm:ss'));
      // Now, for each challan, check pending_data for challan_date_time matching yesterday (IST)
      const challansForYesterday = [];
      challans.forEach(challan => {
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
              const itemDate = momentTz(item.challan_date_time, 'DD-MM-YYYY HH:mm:ss').tz('Asia/Kolkata').startOf('day');
              if (itemDate.isSame(yesterdayIST, 'day')) {
                challansForYesterday.push({
                  challan_id: challan.id,
                  client_id: challan.client_id,
                  vehicle_number: challan.vehicle_number,
                  amount: item.amount || challan.amount,
                  status: item.status || challan.status,
                  challan_date_time: item.challan_date_time,
                  updated_at: challan.updated_at
                });
              }
            }
          });
        }
      });
      console.log('CHALLANS ISSUED FOR YESTERDAY (by challan_date_time):');
      console.table(challansForYesterday);
      console.log('Total challans issued for yesterday:', challansForYesterday.length);

    // 3. Print all challans for yesterday (already done above)
    // If you want to filter for pending challans for yesterday, you can do so here (code commented out)
    // const pendingChallans = challans.filter(...)

    // 4. Skipped grouping and table generation for clients

    // 5. Only send a summary email to smartchallan@gmail.com
    const logoUrl = process.env.COMPANY_LOGO_URL || '';
    const subject = `Challan Summary for ${yesterdayIST.format('YYYY-MM-DD')}`;
    let html = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;background:#f9f9f9;padding:24px;border-radius:8px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${logoUrl}" alt="Company Logo" style="max-width:180px;max-height:80px;"/>
      </div>
      <h2 style="color:#2d3748;text-align:center;">Challan Summary for ${yesterdayIST.format('YYYY-MM-DD')}</h2>
      <p style="font-size:15px;">Total challans found: <b>${challans.length}</b></p>`;
    if (challans.length > 0) {
      html += `<div style="margin:24px 0;overflow-x:auto;"><table border="1" cellpadding="6" style="border-collapse:collapse;"><thead><tr><th>ID</th><th>Client ID</th><th>Vehicle No</th><th>Amount</th><th>Status</th><th>Updated At</th></tr></thead><tbody>`;
      challans.forEach(challan => {
        html += `<tr><td>${challan.id}</td><td>${challan.client_id}</td><td>${challan.vehicle_number || ''}</td><td>${challan.amount || ''}</td><td>${challan.status || ''}</td><td>${challan.updated_at}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
      // 5. Only send a summary email to smartchallan@gmail.com for challansForYesterday
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
