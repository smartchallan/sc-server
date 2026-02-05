// jobs/dailyChallanNotifyJob.js
// Daily Challan Notification Job
// 1. Fetch all active client users
// 2. Fetch challans updated yesterday
// 3. Filter pending challans for yesterday
// 4. Group by client, prepare table, send email
// 5. Schedule job at configurable time

const models = require('../models');
const { User, VehicleChallan, UserVehicle, UserOptions, DiUserNotificationReceivers } = models;
const { Op } = require('sequelize');
const moment = require('moment');
const config = require('../config/config');
const momentTz = require('moment-timezone');
const { sendMail } = require('../services/emailService');

async function dailyChallanNotifyJob(daysRange = 4) {
	try {
		// 1) Fetch active users with role 'client'
		const clients = await User.findAll({
			where: { status: 'active', role: 'client' },
			attributes: ['id', 'name', 'email', 'client_id'],
			raw: true
		});

		if (!clients || clients.length === 0) {
			console.log('No active client users found');
			return [];
		}

		const clientUserIds = clients.map(c => c.id);

		// 2) Find users who have option 'receive_email_notification' = true (accept common truthy values)
		const truthyValues = ['1', 'true', 'yes', 'on'];
		const options = await UserOptions.findAll({
			where: {
				user_id: { [Op.in]: clientUserIds },
				option_key: 'receive_email_notification',
				[Op.and]: models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('option_value')), { [Op.in]: truthyValues })
			},
			attributes: ['user_id'],
			raw: true
		});

		const usersWithOpt = new Set(options.map(o => o.user_id));
		console.log('Users with receive_email_notification enabled:', Array.from(usersWithOpt));
		if (usersWithOpt.size === 0) {
			console.log('No users with receive_email_notification enabled');
			return [];
		}

		// 3) Find notification receivers for those users: notification_type = 'email', status = true, and a non-empty value
		const receivers = await DiUserNotificationReceivers.findAll({
			where: {
				user_id: { [Op.in]: Array.from(usersWithOpt) },
				notification_type: 'email',
				status: true,
				value: { [Op.not]: null }
			},
			attributes: ['user_id', 'value'],
			raw: true
		});

		const receiverUserIds = new Set(receivers.filter(r => r.value && String(r.value).trim().length > 0).map(r => r.user_id));

		console.log('Users eligible for email notifications based on DiUserNotificationReceivers:', Array.from(receiverUserIds));
		if (receiverUserIds.size === 0) {
			console.log('No users eligible for email notifications based on DiUserNotificationReceivers');
			return [];
		}
		// 4) Build a map of configured receiver emails per user (use the receiver value)
		const receiverMap = receivers.reduce((acc, r) => {
			const val = r.value && String(r.value).trim();
			if (!val) return acc;
			if (!acc[r.user_id]) acc[r.user_id] = [];
			acc[r.user_id].push(val);
			return acc;
		}, {});

		// 5) Filter original clients to those that have configured receiver emails
		const eligibleUsers = clients.filter(u => Array.isArray(receiverMap[u.id]) && receiverMap[u.id].length > 0);

		// 6) Prepare result list of users with their configured email addresses
		const eligibleWithEmails = eligibleUsers.map(u => ({
			user_id: u.id,
			name: u.name,
			client_id: u.client_id,
			configured_emails: receiverMap[u.id] || []
		}));

		console.log('Eligible users and configured emails for notification:');
		console.table(eligibleWithEmails.map(e => ({ user_id: e.user_id, name: e.name, client_id: e.client_id, emails: e.configured_emails.join(', ') })));

		// --- New: Fetch challans for each eligible user's client_id where challan_issued_at is within the specified days range (IST)
		const DiVehicleChallanJob = models.DiVehicleChallanJob;

		// Today's date in IST
		const todayIST = momentTz().tz('Asia/Kolkata');
		console.log('Today (IST):', todayIST.format('YYYY-MM-DD'));

		// Start = today - (daysRange - 1) days (inclusive range), End = today (end of today) in IST
		const startIST = todayIST.clone().subtract(Math.max(0, daysRange - 1), 'days').startOf('day');
		const endIST = todayIST.clone().endOf('day');

		const startUTC = startIST.clone().utc().toDate();
		const endUTC = endIST.clone().utc().toDate();
		

		console.log('Fetching challans with challan_issued_at between', startIST.format(), '(IST) and', endIST.format(), '(IST)');

		const clientChallanResults = [];
		for (const u of eligibleWithEmails) {
			// Treat only null/undefined/empty-string as missing. This allows numeric 0 or other
			// falsy-but-valid values to pass through.
			const hasClientId = u.user_id != null && String(u.user_id).trim() !== '';
			if (!hasClientId) {
				console.log(`Skipping user_id=${u.user_id} (no client_id)`);
				continue;
			}
			const clientId = u.user_id;
			// Fetch from di_vehicle_challan_job for this client_id
			console.log(`Fetching challans for client_id=${clientId} between ${startUTC} and ${endUTC} (UTC)`);
			const dvChallans = await DiVehicleChallanJob.findAll({
				where: {
					client_id: clientId,
					challan_issued_at: { [Op.between]: [startIST, endIST] }
				},
				attributes: ['id', 'vehicle_number', 'challan_number', 'challan_issued_at', 'challan_data', 'challan_status'],
				order: [[ 'challan_issued_at', 'DESC' ]],
				raw: true
			});

			console.log(`Client ${clientId} - challans in range (IST):`, dvChallans.map(c => c.challan_number));
			clientChallanResults.push({ client_id: clientId, user_id: u.user_id, challans: dvChallans });

			// If there are challans, build HTML and send to configured emails
			if (Array.isArray(dvChallans) && dvChallans.length > 0) {
				const rowsHtml = dvChallans.map((c, idx) => {
					// Preserve the DB-stored timestamp values (avoid adding TZ offsets).
					const issuedAt = c.challan_issued_at ? moment.utc(c.challan_issued_at).format('YYYY-MM-DD HH:mm:ss') : '';
					let parsed = {};
					if (c.challan_data) {
						try { parsed = typeof c.challan_data === 'string' ? JSON.parse(c.challan_data) : c.challan_data; } catch (e) { parsed = {}; }
					}
					// Use fine_imposed from challan_data as amount when present
					const rawAmount = parsed.fine_imposed || parsed.amount || parsed.challan_amount || c.amount || '';
					const amount = (rawAmount === null || rawAmount === undefined) ? '' : String(rawAmount).replace(/[^0-9.\-]/g, '');
					// Show actual status from DB (pending/disposed) and color-code it
					const status = c.challan_status || 'pending';
					const statusLower = String(status).toLowerCase();
					const statusColor = statusLower === 'disposed' ? '#16a34a' : (statusLower === 'pending' ? '#dc2626' : '#374151');
					const statusHtml = `<span style="color:${statusColor};font-weight:700;">${status}</span>`;
					return `
						<tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#fff'};">
						  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${idx + 1}</td>
						  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${c.vehicle_number || ''}</td>
						  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${c.challan_number || ''}</td>
						  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${issuedAt}</td>
						  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${amount}</td>
						  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${statusHtml}</td>
						</tr>`;
							}).join('\n');

							// Calculate totals: number of challans in range and total pending amount for the picked challans only
							const issuedCount = dvChallans.length;
							const parseAmount = (cdata) => {
								if (!cdata) return 0;
								let parsed = cdata;
								if (typeof cdata === 'string') {
									try { parsed = JSON.parse(cdata); } catch (e) { parsed = {}; }
								}
								const raw = parsed.fine_imposed || parsed.amount || parsed.challan_amount || parsed.amount_due || 0;
								const num = raw === null || raw === undefined ? 0 : Number(String(raw).replace(/[^0-9.\-]/g, ''));
								return isNaN(num) ? 0 : num;
							};
							// Sum only the picked challans (those in dvChallans) that are currently pending
							const totalPendingAmount = dvChallans.reduce((sum, r) => {
								if (!r) return sum;
								const status = (r.challan_status || 'pending');
								if (String(status).toLowerCase() === 'pending') {
									return sum + parseAmount(r.challan_data);
								}
								return sum;
							}, 0);
							const formatMoney = (n) => n.toLocaleString('en-IN');
							const summaryHtml = `
								<p style="margin:0 0 12px 0;color:#4b5563;">You have total <strong>${issuedCount}</strong> challan(s) issued in last <strong>${daysRange}</strong> day(s). Total pending challans amount for this duration is <strong>Rs. ${formatMoney(totalPendingAmount)}</strong>. For more details, please login to Smart Challan.</p>
							`;

							const html = `
									<div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:820px;margin:auto;padding:0;background:#f3f6f9;border-radius:10px;overflow:hidden;border:1px solid #e6eef8;">
										<div style="background:linear-gradient(90deg,#0ea5b7,#3182ce);padding:18px 24px;text-align:left;color:#fff;">
											<div style="display:flex;align-items:center;gap:12px;">
												<img src="${process.env.COMPANY_LOGO_URL || ''}" alt="SmartChallan" style="height:48px;object-fit:contain;"/>
											</div>
										</div>
										<div style="padding:20px 24px;background:#ffffff;font-size:15px;color:#1f2937;">
											<p style="margin:0 0 12px 0;">Hi <strong>${u.name || 'User'}</strong>,</p>
											<p style="margin:0 0 16px 0;color:#4b5563;">The following challan(s) were issued for your vehicles between <strong>${startIST.format('YYYY-MM-DD')}</strong> and <strong>${endIST.format('YYYY-MM-DD')}</strong> (IST).</p>
											${summaryHtml}

											<div style="border:1px solid #eef2f6;border-radius:8px;padding:12px;overflow-x:auto;">
												<table style="width:100%;border-collapse:separate;border-spacing:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
													<thead>
														<tr style="background:#f8fafc;">
															<th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">S.no.</th>
															<th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Vehicle No.</th>
															<th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Challan No.</th>
															<th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Challan Issued At</th>
															<th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:right;font-weight:600;font-size:13px;">Amount</th>
															<th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Status</th>
														</tr>
													</thead>
													<tbody>
														${rowsHtml}
													</tbody>
												</table>
											</div>

											<div style="margin-top:16px;">
												<a href="https://app.smartchallan.com" target="_blank" rel="noopener noreferrer" style="background:#0ea5b7;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Open Dashboard</a>
												<div style="margin-top:8px;">
													<a href="mailto:support@smartchallan.com?subject=Challan%20Query%20for%20${u.name}" style="color:#3182ce;text-decoration:none;font-weight:600;">Contact Support</a>
												</div>
											</div>
                      
											<p style="margin-top:18px;font-size:13px;color:#6b7280;">You are receiving this email because you (or someone on your team) configured notifications for your account.</p>
											<p style="margin:0;color:#6b7280;">Regards,<br/>${process.env.COMPANY_NAME || 'SmartChallan'} Team</p>
										</div>
										<div style="padding:12px 20px;background:#f8fafc;font-size:12px;color:#6b7280;text-align:center;">&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'SmartChallan'}. All rights reserved.</div>
									</div>`;

							const to = (u.configured_emails || []).join(',') || 'smartchallan@gmail.com'; // use configured emails or fallback to testing override
				if (to) {
					try {
						await sendMail({ to, subject: `Challan(s) issued - ${process.env.COMPANY_NAME || 'SmartChallan'}`, html });
						console.log(`Sent challan email to ${to} for client ${clientId}`);
					} catch (err) {
						console.error(`Failed to send challan email to ${to} for client ${clientId}:`, err);
					}
				}
			}

			
            
		}

		// mark todo steps completed
		return { eligible: eligibleWithEmails, challans_by_client: clientChallanResults };
	} catch (err) {
		console.error('Error fetching clients in dailyChallanNotifyJob:', err);
		throw err;
	}
}

module.exports = dailyChallanNotifyJob;
