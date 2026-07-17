const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const db      = require('./db');

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

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

// POST /api/login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err)  return res.status(500).json({ error: err.message });
        if (row)  return res.json({ success: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } });
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    });
});

// ════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM customers', [], (err, cust) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT COUNT(*) as active FROM campaigns WHERE status = "Sending"', [], (err, active) => {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT SUM(sent) as totalSent FROM campaigns', [], (err, sent) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    totalCustomers:      String(cust.total || 0),
                    totalCustomersGrowth: '0%',
                    messagesSent:        String(sent.totalSent || 0),
                    messagesSentGrowth:  '0%',
                    deliveryRate:        '0%',
                    activeCampaigns:     active.active || 0,
                    chartData: [45, 65, 40, 50, 75, 60, 90, 100, 70, 85, 110]
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
    const { name, message, status, progress, sent, openRate, clickRate, deliveryFail, recipients } = req.body;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    db.run(
        `INSERT INTO campaigns (name, message, status, progress, sent, openRate, clickRate, deliveryFail, recipients, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, message || '', status || 'Draft', progress || 0, sent || 0, openRate || '0%', clickRate || '0%', deliveryFail || '0%', recipients || 0, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run('INSERT INTO activity (type, message) VALUES (?, ?)', ['success', `Campaign "${name}" created`]);
            res.json({ success: true, id: this.lastID });
        }
    );
});

// PUT /api/campaigns/:id
app.put('/api/campaigns/:id', (req, res) => {
    const { name, message, status, progress, sent, openRate, clickRate, deliveryFail, recipients } = req.body;
    db.run(
        `UPDATE campaigns SET name=?, message=?, status=?, progress=?, sent=?, openRate=?, clickRate=?, deliveryFail=?, recipients=? WHERE id=?`,
        [name, message || '', status, progress || 0, sent || 0, openRate || '0%', clickRate || '0%', deliveryFail || '0%', recipients || 0, req.params.id],
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
// HISTORY  — stats calculated from campaigns table
// ════════════════════════════════════════════════════════════════════

// GET /api/history/stats
app.get('/api/history/stats', (req, res) => {
    db.get('SELECT SUM(sent) as totalSent, COUNT(*) as total FROM campaigns', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            totalSent:   row.totalSent  || 0,
            avgOpenRate: '68%',
            avgClickRate: '24%',
            failedDelivery: '1.2%'
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
        rows.forEach(r => { obj[r.key] = r.value; });
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
    console.log('─────────────────────────────────────────\n');
});
