const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, 'database.sqlite'));

// All migrations — { table, column, definition }
const migrations = [
    // Original customers columns
    { table: 'customers', column: 'email',   definition: 'TEXT DEFAULT ""' },
    { table: 'customers', column: 'tags',    definition: 'TEXT DEFAULT ""' },
    // WhatsApp integration — media table
    { table: 'media',     column: 'mediaId', definition: 'TEXT DEFAULT NULL' }, // Meta media_id after upload
];

db.serialize(() => {
    let done = 0;

    migrations.forEach(({ table, column, definition }) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
            if (err && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
                console.log(`  ⏭️  "${table}.${column}" already exists — skipping.`);
            } else if (err) {
                console.log(`  ❌ Error adding "${table}.${column}":`, err.message);
            } else {
                console.log(`  ✅ "${table}.${column}" added successfully!`);
            }

            done++;
            if (done === migrations.length) {
                db.close(() => console.log('\n✅ All migrations complete.'));
            }
        });
    });
});
