// Run this script ONCE to create the admin user
// Usage: node create-admin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123'; // Change this!
const ADMIN_EMAIL = 'admin@autoai.com';

setTimeout(async () => {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    db.run(
        `INSERT OR IGNORE INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
        [ADMIN_USERNAME, ADMIN_EMAIL, hash],
        function(err) {
            if (err) {
                console.error('❌ Error creating admin:', err.message);
            } else if (this.changes === 0) {
                console.log('⚠️  Admin user already exists.');
            } else {
                console.log(`✅ Admin user created!`);
                console.log(`   Username: ${ADMIN_USERNAME}`);
                console.log(`   Password: ${ADMIN_PASSWORD}`);
                console.log(`   ⚠️  Please change the password after first login!`);
            }
            db.close();
        }
    );
}, 500);
