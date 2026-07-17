const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {

        // ─── USERS TABLE ─────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                name     TEXT    NOT NULL DEFAULT 'Admin',
                email    TEXT    UNIQUE NOT NULL,
                password TEXT    NOT NULL,
                role     TEXT    NOT NULL DEFAULT 'Administrator',
                status   TEXT    NOT NULL DEFAULT 'Active',
                createdAt TEXT   DEFAULT (datetime('now'))
            )
        `);

        // ─── CUSTOMERS TABLE ─────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS customers (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT    NOT NULL,
                phone     TEXT    NOT NULL,
                email     TEXT,
                status    TEXT    NOT NULL DEFAULT 'Active',
                tags      TEXT    DEFAULT '',
                dateAdded TEXT    DEFAULT (date('now'))
            )
        `);

        // ─── CAMPAIGNS TABLE ──────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT    NOT NULL,
                message      TEXT    DEFAULT '',
                status       TEXT    NOT NULL DEFAULT 'Draft',
                progress     INTEGER DEFAULT 0,
                sent         INTEGER DEFAULT 0,
                openRate     TEXT    DEFAULT '0%',
                clickRate    TEXT    DEFAULT '0%',
                deliveryFail TEXT    DEFAULT '0%',
                recipients   INTEGER DEFAULT 0,
                date         TEXT    DEFAULT (date('now'))
            )
        `);

        // ─── MEDIA TABLE ──────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS media (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id  INTEGER,
                filename     TEXT    NOT NULL,
                originalName TEXT    NOT NULL,
                mimetype     TEXT    NOT NULL,
                size         INTEGER NOT NULL,
                type         TEXT    NOT NULL,
                url          TEXT    NOT NULL,
                uploadedAt   TEXT    DEFAULT (datetime('now')),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )
        `);

        // ─── SETTINGS TABLE ───────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // ─── ACTIVITY LOG TABLE ───────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS activity (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                type      TEXT    NOT NULL,
                message   TEXT    NOT NULL,
                createdAt TEXT    DEFAULT (datetime('now'))
            )
        `);

        // ─── SEED DEFAULT DATA ────────────────────────────────────────
        db.get("SELECT * FROM users WHERE email = 'admin@company.com'", (err, row) => {
            if (!row) {
                db.run(`INSERT INTO users (name, email, password, role, status)
                        VALUES ('Admin', 'admin@company.com', 'password123', 'Administrator', 'Active')`);
            }
        });

        db.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare(`INSERT INTO customers (name, phone, email, status, tags, dateAdded) VALUES (?, ?, ?, ?, ?, ?)`);
                stmt.run("John Doe",     "+1 (555) 123-4567", "john@example.com",  "Active",  "VIP",      "Oct 24, 2023");
                stmt.run("Alice Smith",  "+44 7700 900077",   "alice@example.com", "Opt-out", "",         "Oct 22, 2023");
                stmt.run("Robert Jones", "+1 (555) 987-6543", "rob@example.com",   "Active",  "Customer", "Oct 20, 2023");
                stmt.finalize();
            }
        });

        db.get("SELECT COUNT(*) as count FROM campaigns", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare(`INSERT INTO campaigns (name, message, status, progress, sent, openRate, clickRate, deliveryFail, recipients, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                stmt.run("Summer Sale 2024",  "Hello {{name}}, check out our summer deals!", "Sending",   45,  124000, "68%", "24%", "1.2%", 124000, "Oct 24, 2023");
                stmt.run("VIP Announcement",  "Hi {{name}}, you are invited to our VIP event.", "Completed", 100, 45210,  "72%", "28%", "0.5%", 45210,  "Oct 20, 2023");
                stmt.finalize();
            }
        });

        db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
            if (row && row.count === 0) {
                const defaults = [
                    ['app_name',       'WhatsApp Campaign Manager'],
                    ['timezone',       'UTC+01:00'],
                    ['language',       'English'],
                    ['access_token',   'EAAOl7ZA6qZBHgBO7yZC...'],
                    ['phone_id',       '102938475610293'],
                    ['business_id',    '883746291038475'],
                    ['webhook_url',    'https://api.yourdomain.com/v1/whatsapp/webhook'],
                    ['webhook_token',  'secret_token_12345'],
                    ['two_factor',     'false'],
                ];
                const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
                defaults.forEach(([k, v]) => stmt.run(k, v));
                stmt.finalize();
            }
        });

        db.get("SELECT COUNT(*) as count FROM activity", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare("INSERT INTO activity (type, message, createdAt) VALUES (?, ?, ?)");
                stmt.run("success",  "Campaign \"Summer Sale\" started",      "2024-10-24 09:00:00");
                stmt.run("info",     "Imported 500 new contacts",             "2024-10-24 07:00:00");
                stmt.run("neutral",  "Campaign \"Win Back\" completed",       "2024-10-23 18:00:00");
                stmt.run("danger",   "Delivery failure rate spike detected",  "2024-10-23 15:00:00");
                stmt.finalize();
            }
        });
    });
}

module.exports = db;
