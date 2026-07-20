const { db, encrypt, decrypt } = require('./src/db');

setTimeout(() => {
    // Test 1: encrypt/decrypt round-trip
    const original = 'EAAOl7ZA6qZBHgBO_test_token';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    const cryptoOk  = decrypted === original;
    console.log('\n=== WhatsApp Integration Verification ===\n');
    console.log('1. AES-256-GCM encrypt/decrypt:', cryptoOk ? '✅ PASS' : '❌ FAIL');
    if (!cryptoOk) {
        console.log('   original :', original);
        console.log('   decrypted:', decrypted);
    }

    // Test 2: decrypt plain (non-encrypted) value — backward compat
    const plain     = 'plain_old_value';
    const decPlain  = decrypt(plain);
    console.log('2. Decrypt plain (no-op):       ', decPlain === plain ? '✅ PASS' : '❌ FAIL');

    // Test 3: list tables
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
        if (err) { console.error('DB error:', err.message); db.close(); return; }
        console.log('3. DB Tables:                   ', rows.map(r => r.name).join(', '));

        // Test 4: check templates table exists
        const hasTemplates = rows.some(r => r.name === 'templates');
        console.log('4. templates table:             ', hasTemplates ? '✅ PASS' : '❌ MISSING');

        // Test 5: check media.mediaId column
        db.all("PRAGMA table_info(media)", [], (err2, cols) => {
            if (err2) { console.error('PRAGMA error:', err2.message); db.close(); return; }
            const hasMediaId = cols.some(c => c.name === 'mediaId');
            console.log('5. media.mediaId column:        ', hasMediaId ? '✅ PASS' : '❌ MISSING');

            // Test 6: check settings have access_token (should be encrypted)
            db.get("SELECT value FROM settings WHERE key='access_token'", [], (err3, row) => {
                if (err3) { console.error('Settings error:', err3.message); db.close(); return; }
                const isEncrypted = row && row.value && row.value.includes(':');
                console.log('6. access_token encrypted:      ', isEncrypted ? '✅ PASS' : '⚠️  Not encrypted (run app once to seed)');

                // Test 7: templates seed
                db.get("SELECT COUNT(*) as c FROM templates", [], (err4, trow) => {
                    console.log('7. templates seeded:            ', (trow && trow.c > 0) ? `✅ ${trow.c} template(s)` : '⚠️  Empty (start server once to seed)');
                    console.log('\n=== All checks done ===\n');
                    db.close();
                });
            });
        });
    });
}, 600);
