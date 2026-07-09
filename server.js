const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'super-secret-key-for-autoai',
    resave: false,
    saveUninitialized: false
}));

// --- API Endpoints ---

// Get current user session
app.get('/api/auth/me', (req, res) => {
    if (req.session.userId) {
        res.json({ id: req.session.userId, username: req.session.username });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

            req.session.userId = user.id;
            req.session.username = user.username;
            res.json({ message: 'Logged in successfully', user: { id: user.id, username: user.username } });
        });
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Get all cars
app.get('/api/cars', (req, res) => {
    db.all(`SELECT * FROM cars`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // parse features string back into array
        const cars = rows.map(car => ({
            ...car,
            features: JSON.parse(car.features)
        }));
        res.json(cars);
    });
});

// Get specific car
app.get('/api/cars/:id', (req, res) => {
    db.get(`SELECT * FROM cars WHERE id = ?`, [req.params.id], (err, car) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!car) return res.status(404).json({ error: 'Car not found' });

        car.features = JSON.parse(car.features);
        res.json(car);
    });
});

// Checkout process
app.post('/api/checkout', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Must be logged in to checkout' });
    }

    const { carId, address } = req.body;
    if (!carId) {
        return res.status(400).json({ error: 'Car ID is required' });
    }
    
    const addressStr = address ? `${address.street}, ${address.city}, ${address.zip}` : null;

    // Process the order
    db.run(`INSERT INTO orders (user_id, car_id, address) VALUES (?, ?, ?)`, [req.session.userId, carId, addressStr], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Order placed successfully!', orderId: this.lastID });
    });
});

// Fallback removed to avoid path-to-regexp error in Express v5, 
// express.static handles index.html for root.

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
