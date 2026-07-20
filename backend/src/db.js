const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const crypto  = require('crypto');

// ─── Token Encryption ─────────────────────────────────────────────────────────
// Uses AES-256-GCM with a key derived from an env variable or a local fallback.
// Set ENCRYPT_KEY in your environment for production (32-char string).
const RAW_KEY    = process.env.ENCRYPT_KEY || 'formoler-whatsapp-secret-key-32x';
const CIPHER_KEY = crypto.createHash('sha256').update(RAW_KEY).digest(); // 32 bytes
const ALGO       = 'aes-256-gcm';

/**
 * Encrypt a plaintext string.
 * @param {string} text
 * @returns {string}  "iv:authTag:ciphertext" (hex-encoded)
 */
function encrypt(text) {
    if (!text) return text;
    const iv         = crypto.randomBytes(12);          // 96-bit IV for GCM
    const cipher     = crypto.createCipheriv(ALGO, CIPHER_KEY, iv);
    const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag    = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt a string produced by encrypt().
 * Returns the original text, or the input unchanged if it was never encrypted.
 * @param {string} encoded
 * @returns {string}
 */
function decrypt(encoded) {
    if (!encoded || !encoded.includes(':')) return encoded; // not encrypted
    try {
        const [ivHex, tagHex, dataHex] = encoded.split(':');
        const iv       = Buffer.from(ivHex,  'hex');
        const authTag  = Buffer.from(tagHex, 'hex');
        const data     = Buffer.from(dataHex,'hex');
        const decipher = crypto.createDecipheriv(ALGO, CIPHER_KEY, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
        return encoded; // return as-is if decryption fails (e.g. plain legacy value)
    }
}

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

        // ─── CAMPAIGN CUSTOMERS TABLE (RELATION) ──────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS campaign_customers (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id     INTEGER NOT NULL,
                customer_id     INTEGER NOT NULL,
                status          TEXT    NOT NULL DEFAULT 'Pending',
                errorMessage    TEXT    DEFAULT '',
                deliveredAt     TEXT    NULL,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            )
        `);

        // ─── SETTINGS TABLE ───────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // ─── TEMPLATES TABLE ──────────────────────────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS templates (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL UNIQUE,
                displayName TEXT    NOT NULL DEFAULT '',
                category    TEXT    NOT NULL DEFAULT 'MARKETING',
                language    TEXT    NOT NULL DEFAULT 'en_US',
                status      TEXT    NOT NULL DEFAULT 'pending',
                bodyText    TEXT    DEFAULT '',
                createdAt   TEXT    DEFAULT (datetime('now'))
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
            // Leave customers empty — no fake data
        });

        db.get("SELECT COUNT(*) as count FROM campaigns", (err, row) => {
            // Leave campaigns empty — no fake data
        });

        db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
            if (row && row.count === 0) {
                const defaults = [
                    ['app_name',          'WhatsApp Campaign Manager'],
                    ['timezone',          'UTC+01:00'],
                    ['language',          'English'],
                    ['access_token',      encrypt('EAAOl7ZA6qZBHgBO7yZC...')],
                    ['phone_id',          '102938475610293'],
                    ['business_id',       '883746291038475'],
                    ['webhook_url',       'https://api.yourdomain.com/v1/whatsapp/webhook'],
                    ['webhook_token',     'secret_token_12345'],
                    ['two_factor',        'false'],
                    ['whatsapp_delay_ms', '1000'],
                ];
                const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
                defaults.forEach(([k, v]) => stmt.run(k, v));
                stmt.finalize();
            }
        });

        // Seed one example template
        db.get("SELECT COUNT(*) as count FROM templates", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO templates (name, displayName, category, language, status, bodyText)
                        VALUES ('hello_world', 'Hello World', 'UTILITY', 'en_US', 'approved',
                        'Hello {{1}}! This is a test message from our platform.')`);
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

module.exports = { db, encrypt, decrypt };

