const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'autoai.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users table — added role, email, created_at
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'customer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Cars table — added category, description, ai_statistics, year, mileage, color, status, views, recommended
    db.run(`
        CREATE TABLE IF NOT EXISTS cars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            make TEXT NOT NULL,
            model TEXT NOT NULL,
            year INTEGER,
            price TEXT NOT NULL,
            price_num REAL,
            type TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            powertrain TEXT NOT NULL,
            features TEXT NOT NULL,
            image TEXT NOT NULL,
            description TEXT,
            ai_statistics TEXT,
            mileage TEXT,
            color TEXT,
            status TEXT DEFAULT 'available',
            views INTEGER DEFAULT 0,
            recommended INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Orders table — added status, payment_method, notes
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            car_id INTEGER NOT NULL,
            address TEXT,
            status TEXT DEFAULT 'pending',
            payment_method TEXT DEFAULT 'card',
            notes TEXT,
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (car_id) REFERENCES cars (id)
        )
    `);

    // User browsing/view history for personalized recommendations
    db.run(`
        CREATE TABLE IF NOT EXISTS user_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            car_id INTEGER NOT NULL,
            viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (car_id) REFERENCES cars (id)
        )
    `);

    // Chat history for personalized recommendations
    db.run(`
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // --- Schema Migrations: Add new columns if they don't exist ---
    // Handles case where DB already exists without new columns
    const migrations = [
        `ALTER TABLE users ADD COLUMN email TEXT`,
        `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'`,
        `ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
        `ALTER TABLE cars ADD COLUMN category TEXT DEFAULT 'General'`,
        `ALTER TABLE cars ADD COLUMN description TEXT`,
        `ALTER TABLE cars ADD COLUMN ai_statistics TEXT`,
        `ALTER TABLE cars ADD COLUMN year INTEGER`,
        `ALTER TABLE cars ADD COLUMN price_num REAL`,
        `ALTER TABLE cars ADD COLUMN mileage TEXT`,
        `ALTER TABLE cars ADD COLUMN color TEXT`,
        `ALTER TABLE cars ADD COLUMN status TEXT DEFAULT 'available'`,
        `ALTER TABLE cars ADD COLUMN views INTEGER DEFAULT 0`,
        `ALTER TABLE cars ADD COLUMN recommended INTEGER DEFAULT 0`,
        `ALTER TABLE cars ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
        `ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'`,
        `ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'card'`,
        `ALTER TABLE orders ADD COLUMN notes TEXT`,
    ];

    migrations.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore "duplicate column" errors silently
        });
    });
});

module.exports = db;
