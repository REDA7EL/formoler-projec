require('dotenv').config(); // Load .env first

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const wa      = require('./whatsapp-web');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── UPLOADS FOLDER ──────────────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// ─── MULTER STORAGE ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename:    (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = [
        // images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        // videos
        'video/mp4', 'video/webm', 'video/quicktime', 'video/avi',
        // audio / vocal
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/aac'
    ];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }  // 50 MB max
});

app.use(cors());
app.use(express.json());

// Local Electron sessions. The token is issued at login and required for all
// WhatsApp Web connection operations; role claims from the browser are never trusted.
const sessions = new Map();
const requireDeveloper = (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Authentication required.' });
    if (session.role !== 'Developer') return res.status(403).json({ error: 'Developer role required.' });
    req.user = session;
    next();
};

// WhatsApp Web connection API.  Both root paths and /api/whatsapp aliases are
// available so Electron and external local integrations share one client.
const connectionStatus = (_req, res) => res.json(wa.getStatus());
const connectionQr = async (_req, res) => {
    try { await wa.initialize(); res.json(wa.getStatus()); }
    catch (error) { res.status(503).json({ ...wa.getStatus(), error: error.message }); }
};
const disconnectWhatsApp = async (_req, res) => {
    try { res.json(await wa.disconnect()); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
};
const sendMessage = async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) return res.status(400).json({ success: false, error: 'phone and message are required' });
        res.json(await wa.sendTextMessage(phone, message));
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
};
['/status', '/api/whatsapp/status'].forEach(route => app.get(route, requireDeveloper, connectionStatus));
['/qr', '/api/whatsapp/qr'].forEach(route => app.get(route, requireDeveloper, connectionQr));
['/disconnect', '/api/whatsapp/disconnect'].forEach(route => app.post(route, requireDeveloper, disconnectWhatsApp));
['/send-message', '/api/whatsapp/send-message'].forEach(route => app.post(route, requireDeveloper, sendMessage));
app.post('/api/whatsapp/delay', requireDeveloper, (req, res) => {
    const minimum = Math.max(15000, Number(req.body.minimum ?? req.body.delay) || 15000);
    const maximum = Math.max(minimum, Number(req.body.maximum) || minimum);
    db.serialize(() => {
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('delayBetweenMessages', ?)", [String(minimum)]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('maximumDelayBetweenMessages', ?)", [String(maximum)], err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, minimum, maximum });
        });
    });
});

wa.on('message', message => {
    if (message.fromMe) return;
    const preview = (message.body || `[${message.type}]`).slice(0, 100);
    db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['info', `Reply from ${message.from}: ${preview}`]);
});

// ─── In-flight campaign guard ────────────────────────────────────────────────
// Tracks campaign IDs that are currently being sent in this process.
// Prevents duplicate sends if the HTTP route is called more than once, AND
// prevents the auto-resume from re-triggering a campaign already running.
// NOTE: This is an in-memory Set — it resets on every server restart (intentionally,
// because that is exactly when we WANT auto-resume to re-run for stuck campaigns).
const activeSendingCampaigns = new Set();

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

// POST /api/login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err)  return res.status(500).json({ error: err.message });
        if (row) {
            const user = { id: row.id, name: row.name, email: row.email, role: row.role };
            const token = uuidv4();
            sessions.set(token, user);
            return res.json({ success: true, user, token });
        }
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    });
});

// PUT /api/users/password
app.put('/api/users/password', (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    
    // First verify current password
    db.get('SELECT * FROM users WHERE id = ? AND password = ?', [userId, currentPassword], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ success: false, message: 'Incorrect current password' });
        
        // Update to new password
        db.run('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId], function(updateErr) {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ success: true, message: 'Password updated successfully' });
        });
    });
});

// PUT /api/users/profile
app.put('/api/users/profile', (req, res) => {
    const { userId, name, email } = req.body;
    db.run(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [name, email, userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Profile updated successfully', user: { id: userId, name, email } });
        }
    );
});

// ════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM customers', [], (err, cust) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT COUNT(*) as active FROM campaigns WHERE status IN ("Sending", "Scheduled")', [], (err, active) => {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT SUM(sent) as totalSent FROM campaigns', [], (err, sent) => {
                if (err) return res.status(500).json({ error: err.message });
                
                db.all('SELECT date as name, SUM(sent) as messages FROM campaigns GROUP BY date ORDER BY id DESC LIMIT 7', [], (err, chartRows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    // reverse to get chronological order for chart
                    const chartData = chartRows.length > 0 ? chartRows.reverse() : [{name: 'Aucun', messages: 0}];

                    res.json({
                        totalCustomers:      String(cust.total || 0),
                        totalCustomersGrowth: '0%',
                        messagesSent:        String(sent.totalSent || 0),
                        messagesSentGrowth:  '0%',
                        deliveryRate:        '0%',
                        activeCampaigns:     active.active || 0,
                        chartData:           chartData
                    });
                });
            });
        });
    });
});

// GET /api/dashboard/activity
app.get('/api/dashboard/activity', (req, res) => {
    db.all('SELECT * FROM activity ORDER BY createdAt DESC LIMIT 10', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ activity: rows });
    });
});

// ════════════════════════════════════════════════════════════════════
// CUSTOMERS  — GET / POST / PUT / DELETE / BULK DELETE
// ════════════════════════════════════════════════════════════════════

// GET /api/customers?search=&status=
app.get('/api/customers', (req, res) => {
    const { search, status } = req.query;
    let sql    = 'SELECT * FROM customers WHERE 1=1';
    const args = [];
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'; const s = `%${search}%`; args.push(s, s, s); }
    if (status && status !== 'All') { sql += ' AND status = ?'; args.push(status); }
    sql += ' ORDER BY id DESC';
    db.all(sql, args, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ customers: rows });
    });
});

// POST /api/customers
app.post('/api/customers', (req, res) => {
    const { name, phone, email, status, tags } = req.body;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    db.run(
        'INSERT INTO customers (name, phone, email, status, tags, dateAdded) VALUES (?, ?, ?, ?, ?, ?)',
        [name, phone, email || '', status || 'Active', tags || '', date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            // log activity
            db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['info', `New customer "${name}" added`]);
            res.json({ success: true, id: this.lastID });
        }
    );
});

// POST /api/customers/import  — body: { customers: [{ name, phone, tags }] }
app.post('/api/customers/import', (req, res) => {
    const { customers: list } = req.body;
    if (!list || !list.length) return res.status(400).json({ error: 'No customers provided' });

    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const stmt = db.prepare('INSERT INTO customers (name, phone, email, status, tags, dateAdded) VALUES (?, ?, ?, ?, ?, ?)');
    let inserted = 0;

    list.forEach(c => {
        if (c.phone) {
            stmt.run([c.name || '', String(c.phone), '', 'Active', c.tags || '', date]);
            inserted++;
        }
    });

    stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['info', `Imported ${inserted} customers from file`]);
        res.json({ success: true, inserted });
    });
});

// PUT /api/customers/:id
app.put('/api/customers/:id', (req, res) => {
    const { name, phone, email, status, tags } = req.body;
    db.run(
        'UPDATE customers SET name = ?, phone = ?, email = ?, status = ?, tags = ? WHERE id = ?',
        [name, phone, email || '', status, tags || '', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', (req, res) => {
    db.run('DELETE FROM customers WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// DELETE /api/customers  (bulk delete) — body: { ids: [1, 2, 3] }
app.delete('/api/customers', (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'No ids provided' });
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM customers WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// GET /api/customers/groups — Returns unique non-empty tags (groups)
app.get('/api/customers/groups', (req, res) => {
    db.all('SELECT DISTINCT tags FROM customers WHERE tags IS NOT NULL AND tags != "" AND status = "Active" ORDER BY tags ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // tags column can have comma-separated values, collect all unique group names
        const groupSet = new Set();
        rows.forEach(r => {
            r.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => groupSet.add(t));
        });
        res.json({ groups: Array.from(groupSet).sort() });
    });
});

// ════════════════════════════════════════════════════════════════════
// CAMPAIGNS  — GET / POST / PUT / DELETE
// ════════════════════════════════════════════════════════════════════

// GET /api/campaigns?search=&status=
app.get('/api/campaigns', (req, res) => {
    const { search, status } = req.query;
    let sql    = 'SELECT * FROM campaigns WHERE 1=1';
    const args = [];
    if (search) { sql += ' AND name LIKE ?'; args.push(`%${search}%`); }
    if (status && status !== 'All') { sql += ' AND status = ?'; args.push(status); }
    sql += ' ORDER BY id DESC';
    db.all(sql, args, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ campaigns: rows });
    });
});

// GET /api/campaigns/:id
app.get('/api/campaigns/:id', (req, res) => {
    db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Campaign not found' });
        res.json({ campaign: row });
    });
});

// POST /api/campaigns
app.post('/api/campaigns', (req, res) => {
    const { name, message, status, target_audience, media_ids, scheduledAt, specific_customer_ids, skip_duplicates } = req.body;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // First, determine recipients count based on target_audience
    let customerSql = 'SELECT id FROM customers WHERE status = "Active"';
    let customerArgs = [];
    
    if (target_audience === 'Specific' && specific_customer_ids && specific_customer_ids.length > 0) {
        const placeholders = specific_customer_ids.map(() => '?').join(',');
        customerSql = `SELECT id FROM customers WHERE id IN (${placeholders})`;
        customerArgs = specific_customer_ids;
    } else if (target_audience && target_audience.startsWith('Tag:')) {
        const tag = target_audience.replace('Tag:', '').trim();
        customerSql += ' AND tags LIKE ?';
        customerArgs.push(`%${tag}%`);
    }

    db.all(customerSql, customerArgs, (err, customers) => {
        if (err) return res.status(500).json({ error: err.message });

        // ── Skip Duplicates: filter out customers who already received this exact message ──
        const afterDedup = (filteredCustomers) => {
            const recipientsCount = filteredCustomers.length;

            // Insert Campaign
            db.run(
                `INSERT INTO campaigns (name, message, status, progress, sent, openRate, clickRate, deliveryFail, recipients, date, scheduledAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, message || '', status || 'Draft', 0, 0, '0%', '0%', '0%', recipientsCount, date, scheduledAt || null],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const campaignId = this.lastID;

                    // Insert into campaign_customers
                    if (recipientsCount > 0) {
                        const placeholders = filteredCustomers.map(() => '(?, ?, ?)').join(',');
                        const insertArgs = [];
                        filteredCustomers.forEach(c => {
                            insertArgs.push(campaignId, c.id, status === 'Sending' || status === 'Scheduled' ? 'Pending' : 'Draft');
                        });
                        db.run(`INSERT INTO campaign_customers (campaign_id, customer_id, status) VALUES ${placeholders}`, insertArgs, (err) => {
                            if (err) console.error('Failed to link customers', err);
                        });
                    }

                    // Link media
                    if (media_ids && media_ids.length > 0) {
                        const mediaPlaceholders = media_ids.map(() => '?').join(',');
                        db.run(`UPDATE media SET campaign_id = ? WHERE id IN (${mediaPlaceholders})`, [campaignId, ...media_ids], (err) => {
                            if (err) console.error('Failed to link media', err);
                        });
                    }

                    const skippedCount = customers.length - recipientsCount;
                    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} already received this message — skipped)` : '';
                    db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['success', `Campaign "${name}" created${skippedMsg}`]);
                    res.json({ success: true, id: campaignId, recipients: recipientsCount, skipped: skippedCount });
                }
            );
        };

        if (skip_duplicates && message) {
            // Find customer IDs who already received the same message text successfully
            db.all(
                `SELECT DISTINCT cc.customer_id
                 FROM campaign_customers cc
                 JOIN campaigns c ON c.id = cc.campaign_id
                 WHERE cc.status = 'Sent' AND c.message = ?`,
                [message],
                (err, alreadySent) => {
                    if (err) return afterDedup(customers); // on error, don't filter
                    const alreadySentIds = new Set(alreadySent.map(r => r.customer_id));
                    const filtered = customers.filter(c => !alreadySentIds.has(c.id));
                    afterDedup(filtered);
                }
            );
        } else {
            afterDedup(customers);
        }
    });
});

// PUT /api/campaigns/:id
app.put('/api/campaigns/:id', (req, res) => {
    const { name, message, status, progress, sent, openRate, clickRate, deliveryFail, recipients, scheduledAt } = req.body;
    db.run(
        `UPDATE campaigns SET name=?, message=?, status=?, progress=?, sent=?, openRate=?, clickRate=?, deliveryFail=?, recipients=?, scheduledAt=? WHERE id=?`,
        [name, message || '', status, progress || 0, sent || 0, openRate || '0%', clickRate || '0%', deliveryFail || '0%', recipients || 0, scheduledAt || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// DELETE /api/campaigns/:id
app.delete('/api/campaigns/:id', (req, res) => {
    db.run('DELETE FROM campaigns WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// DELETE /api/campaigns  (bulk delete) — body: { ids: [1,2,3] }
app.delete('/api/campaigns', (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'No ids provided' });
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM campaigns WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ════════════════════════════════════════════════════════════════════
// DASHBOARD & ACTIVITY
// ════════════════════════════════════════════════════════════════════

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM customers', [], (err, cust) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT COUNT(*) as active FROM campaigns WHERE status IN ("Sending", "Scheduled")', [], (err, active) => {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT SUM(sent) as totalSent FROM campaigns', [], (err, sent) => {
                if (err) return res.status(500).json({ error: err.message });
                
                db.all('SELECT date, SUM(sent) as messages FROM campaigns GROUP BY date ORDER BY date DESC LIMIT 7', [], (err, chartRows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    const formattedChartData = chartRows.reverse().map(row => {
                        let dayName = row.date;
                        try {
                            const d = new Date(row.date);
                            if (!isNaN(d)) {
                                dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                            }
                        } catch(e) {}
                        return { name: dayName, messages: row.messages || 0 };
                    });

                    if (formattedChartData.length === 0) {
                        formattedChartData.push({ name: 'Today', messages: 0 });
                    }

                    res.json({
                        totalCustomers:      String(cust.total || 0),
                        totalCustomersGrowth: '0%',
                        messagesSent:        String(sent.totalSent || 0),
                        messagesSentGrowth:  '0%',
                        deliveryRate:        '98.5%',
                        activeCampaigns:     active.active || 0,
                        chartData:           formattedChartData
                    });
                });
            });
        });
    });
});

// GET /api/activity
app.get('/api/activity', (req, res) => {
    db.all('SELECT * FROM activity ORDER BY id DESC LIMIT 10', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ activity: rows });
    });
});

// ════════════════════════════════════════════════════════════════════
// HISTORY  — stats calculated from campaigns table
// ════════════════════════════════════════════════════════════════════

// GET /api/history/stats
app.get('/api/history/stats', (req, res) => {
    db.all('SELECT sent, openRate, clickRate, deliveryFail FROM campaigns', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let totalSent = 0;
        let sumOpen = 0;
        let sumClick = 0;
        let sumFail = 0;
        const total = rows.length;

        rows.forEach(r => {
            totalSent += (r.sent || 0);
            sumOpen += parseFloat(r.openRate) || 0;
            sumClick += parseFloat(r.clickRate) || 0;
            sumFail += parseFloat(r.deliveryFail) || 0;
        });

        const avgOpenRate = total > 0 ? (sumOpen / total).toFixed(0) + '%' : '0%';
        const avgClickRate = total > 0 ? (sumClick / total).toFixed(0) + '%' : '0%';
        const failedDelivery = total > 0 ? (sumFail / total).toFixed(1) + '%' : '0%';

        res.json({
            totalSent,
            avgOpenRate,
            avgClickRate,
            failedDelivery
        });
    });
});

// ════════════════════════════════════════════════════════════════════
// SETTINGS  — key/value store
// ════════════════════════════════════════════════════════════════════

// GET /api/settings
app.get('/api/settings', (req, res) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const obj = {};
        rows.forEach(r => {
            obj[r.key] = r.value;
        });
        res.json({ settings: obj });
    });
});

// PUT /api/settings  — body: { key: 'app_name', value: 'My App' }
app.put('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// PUT /api/settings/bulk  — body: { settings: { app_name: 'X', timezone: 'Y', ... } }
app.put('/api/settings/bulk', (req, res) => {
    const { settings } = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    Object.entries(settings).forEach(([k, v]) => stmt.run(k, v));
    stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ════════════════════════════════════════════════════════════════════
// TEAM  — users management (for Settings > Team tab)
// ════════════════════════════════════════════════════════════════════

// GET /api/team
app.get('/api/team', (req, res) => {
    db.all('SELECT id, name, email, role, status, createdAt FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ team: rows });
    });
});

// POST /api/team
app.post('/api/team', (req, res) => {
    const { name, email, role, password } = req.body;
    db.run(
        'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [name, email, password || 'changeme123', role || 'Viewer', 'Active'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// DELETE /api/team/:id
app.delete('/api/team/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// MEDIA UPLOAD
// ════════════════════════════════════════════════════════════════════

// Helper: detect type from mimetype
function detectType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'file';
}

// POST /api/media/upload
// Upload a single file (image / video / audio)
// Field name: "file"  |  Optional body: campaign_id
app.post('/api/media/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { campaign_id } = req.body;
    const type     = detectType(req.file.mimetype);
    const url      = `http://localhost:${PORT}/uploads/${req.file.filename}`;

    db.run(
        `INSERT INTO media (campaign_id, filename, originalName, mimetype, size, type, url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [campaign_id || null, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, type, url],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                success:      true,
                id:           this.lastID,
                filename:     req.file.filename,
                originalName: req.file.originalname,
                mimetype:     req.file.mimetype,
                size:         req.file.size,
                type,
                url
            });
        }
    );
});

// POST /api/media/upload-multiple
// Upload up to 5 files at once
app.post('/api/media/upload-multiple', upload.array('files', 5), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const { campaign_id } = req.body;
    const results = [];

    const stmt = db.prepare(
        `INSERT INTO media (campaign_id, filename, originalName, mimetype, size, type, url) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    req.files.forEach(file => {
        const type = detectType(file.mimetype);
        const url  = `http://localhost:${PORT}/uploads/${file.filename}`;
        stmt.run([campaign_id || null, file.filename, file.originalname, file.mimetype, file.size, type, url]);
        results.push({ filename: file.filename, originalName: file.originalname, mimetype: file.mimetype, size: file.size, type, url });
    });

    stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, files: results });
    });
});

// GET /api/media?campaign_id=&type=
// Get all uploaded media (optionally filtered by campaign or type)
app.get('/api/media', (req, res) => {
    const { campaign_id, type } = req.query;
    let sql = 'SELECT * FROM media WHERE 1=1';
    const args = [];
    if (campaign_id) { sql += ' AND campaign_id = ?'; args.push(campaign_id); }
    if (type)        { sql += ' AND type = ?';        args.push(type); }
    sql += ' ORDER BY uploadedAt DESC';
    db.all(sql, args, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ media: rows });
    });
});

// DELETE /api/media/:id
// Delete a media file from disk + database
app.delete('/api/media/:id', (req, res) => {
    db.get('SELECT * FROM media WHERE id = ?', [req.params.id], (err, row) => {
        if (err)  return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Media not found' });

        // Delete file from disk
        const filePath = path.join(UPLOADS_DIR, row.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        db.run('DELETE FROM media WHERE id = ?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// ════════════════════════════════════════════════════════════════════
// WHATSAPP
// ════════════════════════════════════════════════════════════════════

// POST /api/whatsapp/test
// Body: { token, phoneNumberId } — or reads from settings if body omitted
app.post('/api/whatsapp/test', async (req, res) => {
    try {
        const getSettingAsync = (key) => new Promise((resolve, reject) => {
            db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });

        // Decrypt stored token (may be encrypted)
        const rawToken      = req.body.token         || await getSettingAsync('apiTokenInstance');
        const token         = decrypt(rawToken);
        const idInstance    = req.body.idInstance    || await getSettingAsync('idInstance');
        const apiUrl        = req.body.apiUrl        || await getSettingAsync('apiUrl');

        if (!token || !idInstance || !apiUrl) {
            return res.status(400).json({ success: false, error: 'Missing token, idInstance or apiUrl' });
        }

        const result = await wa.testConnection(token, idInstance, apiUrl);
        if (result.success) {
            db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['success', 'WhatsApp API connection tested successfully']);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/whatsapp/upload-media
// Uploads a file from the local uploads folder to Meta and returns a reusable media_id.
// Body: { filename, mimeType }  — filename must exist in the uploads directory
app.post('/api/whatsapp/upload-media', async (req, res) => {
    try {
        const { filename, mimeType } = req.body;
        if (!filename || !mimeType) {
            return res.status(400).json({ success: false, error: 'filename and mimeType are required' });
        }

        const filePath = path.join(UPLOADS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found in uploads directory' });
        }

        const getSettingAsync = (key) => new Promise((resolve, reject) => {
            db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });

        const token         = decrypt(await getSettingAsync('apiTokenInstance'));
        const idInstance    = await getSettingAsync('idInstance');
        const apiUrl        = await getSettingAsync('apiUrl');

        if (!token || !idInstance || !apiUrl) {
            return res.status(400).json({ success: false, error: 'WhatsApp API credentials not configured' });
        }

        // Green API does not require pre-uploading media like Meta.
        // We just return the filename as a reference for sendFileByUpload
        const result = { success: true, mediaId: filename };

        if (result.success) {
            // Optionally persist the media_id alongside the media record in DB
            db.run('UPDATE media SET mediaId = ? WHERE filename = ?', [result.mediaId, filename], (err) => {
                if (err) console.warn('Could not store mediaId in DB (column may not exist yet):', err.message);
            });
            db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['info', `Media ready for Green API: ${filename}`]);
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/campaigns/:id/send
// Triggers actual WhatsApp sending for all Pending/Draft customers (skips Opt-out)
app.post('/api/campaigns/:id/send', async (req, res) => {
    const campaignId = parseInt(req.params.id, 10);

    // ─ Guard: reject if this campaign is already sending in this process ─
    if (activeSendingCampaigns.has(campaignId)) {
        return res.status(409).json({
            success: false,
            error: 'Campaign is already being sent. Please wait for it to complete.'
        });
    }

    try {
        // ── Load campaign ──────────────────────────────────────────────
        const campaign = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Campaign not found'));
                else resolve(row);
            });
        });

        // ── Load & decrypt API credentials from settings ───────────────
        const settings = await new Promise((resolve, reject) => {
            db.all('SELECT key, value FROM settings', [], (err, rows) => {
                if (err) reject(err);
                else {
                    const obj = {};
                    rows.forEach(r => { obj[r.key] = r.value; });
                    resolve(obj);
                }
            });
        });

        const delayMs       = Math.max(15000, parseInt(settings['delayBetweenMessages'] || '20000', 10));
        const maximumDelayMs = Math.max(delayMs, parseInt(settings['maximumDelayBetweenMessages'] || '45000', 10));
        
        // ── Daily Limit Setup ──────────────────────────────────────────
        const maxDaily = parseInt(settings['maxMessagesPerDay'] || '300', 10);
        let dailySentCount = parseInt(settings['dailySentCount'] || '0', 10);
        let dailySentDate  = settings['dailySentDate'] || '';
        const todayStr     = new Date().toISOString().split('T')[0];

        // Reset if it's a new day
        if (dailySentDate !== todayStr) {
            dailySentCount = 0;
            dailySentDate  = todayStr;
            db.run("UPDATE settings SET value = ? WHERE key = 'dailySentDate'", [todayStr]);
            db.run("UPDATE settings SET value = '0' WHERE key = 'dailySentCount'");
        }

        if (!wa.getStatus().connected) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp is not connected. Open Settings > WhatsApp Connection and scan the QR code.'
            });
        }

        // ── Load customers — include status to skip Opt-out ────────────
        const customers = await new Promise((resolve, reject) => {
            db.all(
                `SELECT cc.id as cc_id, c.id, c.name, c.phone, c.status
                 FROM campaign_customers cc
                 JOIN customers c ON c.id = cc.customer_id
                 WHERE cc.campaign_id = ? AND cc.status IN ('Pending', 'Draft')`,
                [campaignId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // Count non-opted-out recipients for the response
        const activeCount = customers.filter(c => c.status !== 'Opt-out').length;

        if (activeCount === 0) {
            return res.status(400).json({ success: false, error: 'No eligible recipients (all are Opt-out or already sent).' });
        }

        // ── Load campaign media ────────────────────────────────────────
        const media = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM media WHERE campaign_id = ?', [campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // ── Optional: load template if campaign specifies one ──────────
        const template = req.body.template || null; // { name, language, components }

        // ── Mark campaign as Sending ───────────────────────────────────
        db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['Sending', campaignId]);
        db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
            ['info', `Campaign "${campaign.name}" sending started (${activeCount} recipients, ${customers.length - activeCount} skipped)`]);

        // Respond immediately — send happens in background
        res.json({
            success:  true,
            message:  `Campaign started — sending to ${activeCount} recipients (${customers.length - activeCount} Opt-out skipped).`,
            total:    activeCount,
            skipped:  customers.length - activeCount
        });

        // ─ Mark as in-flight ─
        activeSendingCampaigns.add(campaignId);
        wa.sendCampaign(
            customers,
            campaign.message,
            media,
            delayMs,
            maximumDelayMs,
            (result) => {
                if (result.skipped) {
                    // Mark opted-out customer as Skipped
                    db.run(
                        `UPDATE campaign_customers SET status = 'Skipped'
                         WHERE campaign_id = ? AND customer_id = ?`,
                        [campaignId, result.customerId]
                    );
                    return;
                }

                const status      = result.success ? 'Sent' : 'Failed';
                const deliveredAt = result.success ? new Date().toISOString() : null;
                const errorMsg    = result.success ? '' : (result.error || '');

                db.run(
                    `UPDATE campaign_customers
                     SET status = ?, deliveredAt = ?, errorMessage = ?
                     WHERE campaign_id = ? AND customer_id = ?`,
                    [status, deliveredAt, errorMsg, campaignId, result.customerId]
                );

                if (result.success) {
                    db.run('UPDATE campaigns SET sent = sent + 1 WHERE id = ?', [campaignId]);
                    
                    // Update daily limit
                    dailySentCount++;
                    db.run("UPDATE settings SET value = ? WHERE key = 'dailySentCount'", [dailySentCount]);
                }

                // ── Check if we hit the daily limit ───────────────────
                if (maxDaily > 0 && dailySentCount >= maxDaily) {
                    db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                        ['warning', `Daily send limit reached (${dailySentCount}/${maxDaily}) — campaign "${campaign.name}" paused. It will resume tomorrow.`]);
                    
                    return false; // Tells whatsapp.js to break out of the loop
                }
                
                return true;
            },
            
        ).then(({ sent, failed, skipped, paused }) => {
            const total    = sent + failed;
            const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
            const failRate = total > 0 ? `${Math.round((failed / total) * 100)}%` : '0%';

            // If it was paused due to daily limit, do NOT mark Completed. 
            // It remains in 'Sending' status but the loop has ended, so it acts like "Paused".
            // Auto-resume will pick it up the next day.
            const newStatus = (maxDaily > 0 && dailySentCount >= maxDaily) ? 'Sending' : 'Completed';

            db.run(
                `UPDATE campaigns SET status = ?, progress = ?, deliveryFail = ? WHERE id = ?`,
                [newStatus, progress, failRate, campaignId]
            );
            
            if (newStatus === 'Completed') {
                db.run(
                    'INSERT INTO activity (type, message) VALUES (?, ?)',
                    ['success', `Campaign "${campaign.name}" completed — ${sent} sent, ${failed} failed, ${skipped} skipped`]
                );
            }
        }).catch(err => {
            db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['Draft', campaignId]);
            db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['danger', `Campaign send error: ${err.message}`]);
        }).finally(() => {
            // Always release the lock when the send loop ends (success, failure, or crash)
            activeSendingCampaigns.delete(campaignId);
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/campaigns/:id/progress
app.get('/api/campaigns/:id/progress', (req, res) => {
    const campaignId = req.params.id;
    db.all(
        `SELECT status, COUNT(*) as count
         FROM campaign_customers
         WHERE campaign_id = ?
         GROUP BY status`,
        [campaignId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const counts = { Sent: 0, Failed: 0, Pending: 0, Draft: 0, Skipped: 0 };
            rows.forEach(r => { counts[r.status] = r.count; });

            const sent    = counts.Sent;
            const failed  = counts.Failed;
            const pending = counts.Pending + counts.Draft;
            const skipped = counts.Skipped;
            const total   = sent + failed + pending + skipped;

            // Percentage is out of actionable recipients (excluding skipped opt-outs)
            const actionable  = total - skipped;
            const done        = sent + failed;
            const percentage  = actionable > 0 ? Math.round((done / actionable) * 100) : 0;

            res.json({ total, sent, failed, pending, skipped, percentage });
        }
    );
});

// ════════════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════════════

// GET /api/templates
app.get('/api/templates', (req, res) => {
    db.all('SELECT * FROM templates ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ templates: rows });
    });
});

// POST /api/templates
app.post('/api/templates', (req, res) => {
    const { name, displayName, category, language, status, bodyText } = req.body;
    db.run(
        `INSERT INTO templates (name, displayName, category, language, status, bodyText)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, displayName || name, category || 'MARKETING', language || 'en_US', status || 'pending', bodyText || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// PUT /api/templates/:id
app.put('/api/templates/:id', (req, res) => {
    const { name, displayName, category, language, status, bodyText } = req.body;
    db.run(
        `UPDATE templates SET name=?, displayName=?, category=?, language=?, status=?, bodyText=? WHERE id=?`,
        [name, displayName || name, category || 'MARKETING', language || 'en_US', status || 'pending', bodyText || '', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// DELETE /api/templates/:id
app.delete('/api/templates/:id', (req, res) => {
    db.run('DELETE FROM templates WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ════════════════════════════════════════════════════════════════════
// META WEBHOOK
// ════════════════════════════════════════════════════════════════════

// GET /webhook — Meta verification handshake
// Called once when you register the webhook URL in Meta dashboard.
app.get('/webhook', (req, res) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'my_secret_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Webhook] ✅ Meta verification OK');
        res.status(200).send(challenge); // Must return challenge as plain text
    } else {
        console.warn('[Webhook] ❌ Verification failed — token mismatch');
        res.status(403).json({ error: 'Forbidden — verify token mismatch' });
    }
});

// POST /webhook — Meta sends events here (incoming messages, delivery status)
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);

    // ACK immediately (Meta requires 200 within 5 seconds)
    res.sendStatus(200);

    try {
        const entries = body.entry || [];
        entries.forEach(entry => {
            (entry.changes || []).forEach(change => {
                const value    = change.value || {};
                const messages = value.messages || [];
                const statuses = value.statuses || [];

                // ── Incoming customer messages ────────────────────────────
                messages.forEach(msg => {
                    const from = msg.from;
                    const text = msg.text?.body || `[${msg.type}]`;
                    console.log(`[Webhook] 📨 Message from ${from}: ${text}`);
                    db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                        ['info', `📲 Reply from ${from}: ${text.substring(0, 100)}`]);
                });

                // ── Delivery status updates ───────────────────────────────
                statuses.forEach(status => {
                    if (status.status === 'failed') {
                        const errMsg = status.errors?.[0]?.title || 'Unknown error';
                        console.warn(`[Webhook] ❌ Failed to ${status.recipient_id}: ${errMsg}`);
                        db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                            ['danger', `❌ Delivery failed to ${status.recipient_id}: ${errMsg}`]);
                    }
                    // 'sent', 'delivered', 'read' — can be logged if needed
                });
            });
        });
    } catch (err) {
        console.error('[Webhook] Processing error:', err.message);
    }
});

// ─── MULTER ERROR HANDLER ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum size is 50 MB.' });
        return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
});

// ════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    wa.initialize().catch(error => console.error('WhatsApp Web initialization failed:', error.message));
    console.log(`\n✅  Server running at http://localhost:${PORT}`);
    console.log('─────────────────────────────────────────');
    console.log('  POST   /api/login');
    console.log('  GET    /api/dashboard/stats');
    console.log('  GET    /api/dashboard/activity');
    console.log('  GET    /api/customers  [?search=&status=]');
    console.log('  POST   /api/customers');
    console.log('  PUT    /api/customers/:id');
    console.log('  DELETE /api/customers/:id');
    console.log('  DELETE /api/customers  (bulk)');
    console.log('  GET    /api/campaigns  [?search=&status=]');
    console.log('  POST   /api/campaigns');
    console.log('  PUT    /api/campaigns/:id');
    console.log('  DELETE /api/campaigns/:id');
    console.log('  DELETE /api/campaigns  (bulk)');
    console.log('  GET    /api/history/stats');
    console.log('  GET    /api/settings');
    console.log('  PUT    /api/settings');
    console.log('  PUT    /api/settings/bulk');
    console.log('  GET    /api/team');
    console.log('  POST   /api/team');
    console.log('  DELETE /api/team/:id');
    console.log('  POST   /api/media/upload         (single file)');
    console.log('  POST   /api/media/upload-multiple (up to 5 files)');
    console.log('  GET    /api/media  [?campaign_id=&type=]');
    console.log('  DELETE /api/media/:id');
    console.log('  POST   /api/whatsapp/test');
    console.log('  POST   /api/whatsapp/upload-media');
    console.log('  POST   /api/campaigns/:id/send');
    console.log('  GET    /api/campaigns/:id/progress');
    console.log('  GET    /api/templates');
    console.log('  POST   /api/templates');
    console.log('  PUT    /api/templates/:id');
    console.log('  DELETE /api/templates/:id');
    console.log('  GET    /webhook           (Meta verification)');
    console.log('  POST   /webhook           (Meta events)');
    console.log('─────────────────────────────────────────\n');

    // ════════════════════════════════════════════════════════════════════
    // AUTO-RESUME: campaigns stuck in 'Sending' (from crash or daily limit)
    // ════════════════════════════════════════════════════════════════════
    async function checkAndResumeCampaigns() {
        try {
            const stuckCampaigns = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name FROM campaigns WHERE status = 'Sending'`,
                    [],
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            });

            if (stuckCampaigns.length === 0) return;

            // Load shared settings once
            const settingsRows = await new Promise((resolve, reject) => {
                db.all('SELECT key, value FROM settings', [], (err, rows) => err ? reject(err) : resolve(rows));
            });
            const settings = {};
            settingsRows.forEach(r => { settings[r.key] = r.value; });

            const delayMs    = Math.max(15000, parseInt(settings['delayBetweenMessages'] || '20000', 10));
            const maximumDelayMs = Math.max(delayMs, parseInt(settings['maximumDelayBetweenMessages'] || '45000', 10));
            
            // Daily Limit setup
            const maxDaily = parseInt(settings['maxMessagesPerDay'] || '300', 10);
            let dailySentCount = parseInt(settings['dailySentCount'] || '0', 10);
            let dailySentDate  = settings['dailySentDate'] || '';
            const todayStr     = new Date().toISOString().split('T')[0];

            if (dailySentDate !== todayStr) {
                dailySentCount = 0;
                dailySentDate  = todayStr;
                db.run("UPDATE settings SET value = ? WHERE key = 'dailySentDate'", [todayStr]);
                db.run("UPDATE settings SET value = '0' WHERE key = 'dailySentCount'");
            }

            if (!wa.getStatus().connected) {
                return; // Wait until the locally persisted WhatsApp Web session reconnects.
            }

            // Guard: If we are already at the max limit for today, do not resume yet!
            if (maxDaily > 0 && dailySentCount >= maxDaily) {
                return; 
            }

            for (const campaign of stuckCampaigns) {
                // ─ Guard: skip if already picked up by another code path ─
                if (activeSendingCampaigns.has(campaign.id)) {
                    console.log(`[Auto-Resume] Campaign #${campaign.id} already in-flight, skipping.`);
                    continue;
                }

                // Only resume PENDING recipients — skip Sent/Failed/Skipped to avoid duplicates
                const pendingCustomers = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT cc.id as cc_id, c.id, c.name, c.phone, c.status
                         FROM campaign_customers cc
                         JOIN customers c ON c.id = cc.customer_id
                         WHERE cc.campaign_id = ? AND cc.status = 'Pending'`,
                        [campaign.id],
                        (err, rows) => err ? reject(err) : resolve(rows)
                    );
                });

                if (pendingCustomers.length === 0) {
                    // All recipients already processed — mark Completed
                    db.run(`UPDATE campaigns SET status = 'Completed' WHERE id = ?`, [campaign.id]);
                    console.log(`[Auto-Resume] Campaign #${campaign.id} "${campaign.name}" — all done, marked Completed.`);
                    continue;
                }

                const media = await new Promise((resolve, reject) => {
                    db.all('SELECT * FROM media WHERE campaign_id = ?', [campaign.id],
                        (err, rows) => err ? reject(err) : resolve(rows));
                });

                const campaignRow = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM campaigns WHERE id = ?', [campaign.id],
                        (err, row) => err ? reject(err) : resolve(row));
                });

                console.log(`[Auto-Resume] Resuming campaign #${campaign.id} "${campaign.name}" — ${pendingCustomers.length} pending recipients.`);
                db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                    ['info', `Auto-resumed campaign "${campaign.name}" (${pendingCustomers.length} pending after restart)`]);

                activeSendingCampaigns.add(campaign.id);

                // Resume sending in background (do not await — let the loop continue)
                wa.sendCampaign(
                    pendingCustomers,
                    campaignRow.message,
                    media,
                    delayMs,
                    maximumDelayMs,
                    (result) => {
                        if (result.skipped) {
                            db.run(`UPDATE campaign_customers SET status = 'Skipped' WHERE campaign_id = ? AND customer_id = ?`,
                                [campaign.id, result.customerId]);
                            return;
                        }
                        const status      = result.success ? 'Sent' : 'Failed';
                        const deliveredAt = result.success ? new Date().toISOString() : null;
                        const errorMsg    = result.success ? '' : (result.error || '');
                        db.run(
                            `UPDATE campaign_customers SET status = ?, deliveredAt = ?, errorMessage = ? WHERE campaign_id = ? AND customer_id = ?`,
                            [status, deliveredAt, errorMsg, campaign.id, result.customerId]
                        );
                        if (result.success) {
                            db.run('UPDATE campaigns SET sent = sent + 1 WHERE id = ?', [campaign.id]);
                            dailySentCount++;
                            db.run("UPDATE settings SET value = ? WHERE key = 'dailySentCount'", [dailySentCount]);
                        }
                        
                        // Enforce limit
                        if (maxDaily > 0 && dailySentCount >= maxDaily) {
                            db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                                ['warning', `Daily send limit reached (${dailySentCount}/${maxDaily}) — auto-resumed campaign "${campaign.name}" paused again.`]);
                            return false;
                        }
                        return true;
                    }
                ).then(({ sent, failed, skipped }) => {
                    const total    = sent + failed;
                    const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
                    const failRate = total > 0 ? `${Math.round((failed / total) * 100)}%` : '0%';
                    
                    const newStatus = (maxDaily > 0 && dailySentCount >= maxDaily) ? 'Sending' : 'Completed';
                    
                    db.run(`UPDATE campaigns SET status = ?, progress = ?, deliveryFail = ? WHERE id = ?`,
                        [newStatus, progress, failRate, campaign.id]);
                        
                    if (newStatus === 'Completed') {
                        db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                            ['success', `Campaign "${campaign.name}" resumed & completed — ${sent} sent, ${failed} failed`]);
                    }
                }).catch(err => {
                    console.error(`[Auto-Resume] Campaign #${campaign.id} error:`, err.message);
                    db.run('INSERT INTO activity (type, message) VALUES (?, ?)',
                        ['danger', `Auto-resume error for "${campaign.name}": ${err.message}`]);
                }).finally(() => {
                    activeSendingCampaigns.delete(campaign.id);
                });
            }
        } catch (err) {
            console.error('[Auto-Resume] Background check failed:', err.message);
        }
    }

    // Run once 2 seconds after server starts (to catch crashes)
    setTimeout(checkAndResumeCampaigns, 2000);

    // Then run every 5 minutes (to catch midnight resets while server is running)
    setInterval(checkAndResumeCampaigns, 5 * 60 * 1000);
});
