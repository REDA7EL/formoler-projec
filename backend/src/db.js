const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE,
                    password TEXT
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    phone TEXT,
                    status TEXT,
                    dateAdded TEXT
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS campaigns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    status TEXT,
                    progress INTEGER,
                    sent INTEGER,
                    openRate TEXT,
                    clickRate TEXT,
                    deliveryFail TEXT,
                    date TEXT
                )
            `);

            // Seed dummy user
            db.get("SELECT * FROM users WHERE email = 'admin@company.com'", (err, row) => {
                if (!row) {
                    db.run("INSERT INTO users (email, password) VALUES ('admin@company.com', 'password123')");
                }
            });
            
            // Seed some dummy customers
            db.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
                if (row && row.count === 0) {
                    const stmt = db.prepare("INSERT INTO customers (name, phone, status, dateAdded) VALUES (?, ?, ?, ?)");
                    stmt.run("John Doe", "+1 (555) 123-4567", "Active", "Oct 24, 2023");
                    stmt.run("Alice Smith", "+44 7700 900077", "Opt-out", "Oct 22, 2023");
                    stmt.run("Robert Jones", "+1 (555) 987-6543", "Active", "Oct 20, 2023");
                    stmt.finalize();
                }
            });
            
            // Seed some dummy campaigns
            db.get("SELECT COUNT(*) as count FROM campaigns", (err, row) => {
                if (row && row.count === 0) {
                    const stmt = db.prepare("INSERT INTO campaigns (name, status, progress, sent, openRate, clickRate, deliveryFail, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    stmt.run("Summer Sale 2024", "Sending", 45, 124000, "68%", "24%", "1.2%", "Oct 24, 2023");
                    stmt.run("VIP Announcement", "Completed", 100, 45210, "72%", "28%", "0.5%", "Oct 20, 2023");
                    stmt.finalize();
                }
            });
        });
    }
});

module.exports = db;
