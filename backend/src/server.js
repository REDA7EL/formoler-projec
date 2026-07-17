const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Users API
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json({ success: true, user: { id: row.id, email: row.email } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

// Customers API
app.get('/api/customers', (req, res) => {
    db.all('SELECT * FROM customers', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ customers: rows });
    });
});

app.post('/api/customers', (req, res) => {
    const { name, phone, status, dateAdded } = req.body;
    const stmt = db.prepare('INSERT INTO customers (name, phone, status, dateAdded) VALUES (?, ?, ?, ?)');
    stmt.run([name, phone, status, dateAdded || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

app.put('/api/customers/:id', (req, res) => {
    const { name, phone, status } = req.body;
    const stmt = db.prepare('UPDATE customers SET name = ?, phone = ?, status = ? WHERE id = ?');
    stmt.run([name, phone, status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
    stmt.finalize();
});

app.delete('/api/customers/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
    stmt.run(req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
    stmt.finalize();
});

// Campaigns API
app.get('/api/campaigns', (req, res) => {
    db.all('SELECT * FROM campaigns', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ campaigns: rows });
    });
});

app.post('/api/campaigns', (req, res) => {
    const { name, status, progress, sent, openRate, clickRate, deliveryFail, date } = req.body;
    const stmt = db.prepare(`
        INSERT INTO campaigns (name, status, progress, sent, openRate, clickRate, deliveryFail, date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([name, status, progress, sent, openRate, clickRate, deliveryFail, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

// Dashboard stats
app.get('/api/dashboard/stats', (req, res) => {
    res.json({
        totalCustomers: '0',
        totalCustomersGrowth: '0%',
        messagesSent: '0',
        messagesSentGrowth: '0%',
        deliveryRate: '0%',
        activeCampaigns: 0,
        chartData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
