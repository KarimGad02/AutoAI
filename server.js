require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-key-for-autoai',
    resave: false,
    saveUninitialized: false
}));

// ─── Middleware Helpers ────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
}

// ─── AUTH ENDPOINTS ────────────────────────────────────────────────────────────

// Get current user session
app.get('/api/auth/me', (req, res) => {
    if (req.session.userId) {
        res.json({
            id: req.session.userId,
            username: req.session.username,
            email: req.session.email,
            role: req.session.role
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'customer')`,
            [username, email || null, hash],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(409).json({ error: 'Username or email already taken' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                req.session.userId = this.lastID;
                req.session.username = username;
                req.session.email = email || null;
                req.session.role = 'customer';
                res.json({ message: 'Registered successfully', user: { id: this.lastID, username, role: 'customer' } });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
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
            req.session.email = user.email;
            req.session.role = user.role;
            res.json({ message: 'Logged in successfully', user: { id: user.id, username: user.username, role: user.role } });
        });
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// ─── CAR ENDPOINTS ─────────────────────────────────────────────────────────────

// Get all cars (with optional filters: category, type, powertrain, search)
app.get('/api/cars', (req, res) => {
    let query = `SELECT * FROM cars`;
    const params = [];
    const conditions = [];

    if (req.query.category) { conditions.push(`category = ?`); params.push(req.query.category); }
    if (req.query.type) { conditions.push(`type = ?`); params.push(req.query.type); }
    if (req.query.powertrain) { conditions.push(`powertrain = ?`); params.push(req.query.powertrain); }
    if (req.query.status) { conditions.push(`status = ?`); params.push(req.query.status); }
    if (req.query.recommended) { conditions.push(`recommended = 1`); }

    if (conditions.length > 0) query += ` WHERE ` + conditions.join(' AND ');
    query += ` ORDER BY recommended DESC, views DESC, created_at DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const cars = rows.map(parseCar);
        res.json(cars);
    });
});

// Get specific car
app.get('/api/cars/:id', (req, res) => {
    db.get(`SELECT * FROM cars WHERE id = ?`, [req.params.id], (err, car) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!car) return res.status(404).json({ error: 'Car not found' });

        // Track view
        db.run(`UPDATE cars SET views = views + 1 WHERE id = ?`, [car.id]);
        if (req.session.userId) {
            db.run(`INSERT INTO user_views (user_id, car_id) VALUES (?, ?)`, [req.session.userId, car.id]);
        }
        res.json(parseCar(car));
    });
});

function parseCar(car) {
    return {
        ...car,
        features: safeParseJSON(car.features, []),
        ai_statistics: safeParseJSON(car.ai_statistics, null),
    };
}

function safeParseJSON(str, fallback) {
    try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

// ─── ADMIN CAR CRUD ────────────────────────────────────────────────────────────

// Add car (Admin only)
app.post('/api/admin/cars', requireAdmin, (req, res) => {
    const { make, model, year, price, price_num, type, category, powertrain, features, image, description, ai_statistics, mileage, color, recommended } = req.body;
    if (!make || !model || !price || !type || !powertrain || !image) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const featuresStr = JSON.stringify(Array.isArray(features) ? features : []);
    const statsStr = ai_statistics ? JSON.stringify(ai_statistics) : null;

    db.run(
        `INSERT INTO cars (make, model, year, price, price_num, type, category, powertrain, features, image, description, ai_statistics, mileage, color, recommended) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [make, model, year || null, price, price_num || null, type, category || 'General', powertrain, featuresStr, image, description || null, statsStr, mileage || null, color || null, recommended ? 1 : 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Car added successfully', id: this.lastID });
        }
    );
});

// Update car (Admin only)
app.put('/api/admin/cars/:id', requireAdmin, (req, res) => {
    const { make, model, year, price, price_num, type, category, powertrain, features, image, description, ai_statistics, mileage, color, status, recommended } = req.body;
    const featuresStr = JSON.stringify(Array.isArray(features) ? features : []);
    const statsStr = ai_statistics ? JSON.stringify(ai_statistics) : null;

    db.run(
        `UPDATE cars SET make=?, model=?, year=?, price=?, price_num=?, type=?, category=?, powertrain=?, features=?, image=?, description=?, ai_statistics=?, mileage=?, color=?, status=?, recommended=? WHERE id=?`,
        [make, model, year || null, price, price_num || null, type, category || 'General', powertrain, featuresStr, image, description || null, statsStr, mileage || null, color || null, status || 'available', recommended ? 1 : 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Car not found' });
            res.json({ message: 'Car updated successfully' });
        }
    );
});

// Delete car (Admin only)
app.delete('/api/admin/cars/:id', requireAdmin, (req, res) => {
    db.run(`DELETE FROM cars WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Car not found' });
        res.json({ message: 'Car deleted' });
    });
});

// Get admin stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const stats = {};
    const queries = [
        { key: 'totalCars', sql: `SELECT COUNT(*) as count FROM cars` },
        { key: 'availableCars', sql: `SELECT COUNT(*) as count FROM cars WHERE status='available'` },
        { key: 'soldCars', sql: `SELECT COUNT(*) as count FROM cars WHERE status='sold'` },
        { key: 'totalOrders', sql: `SELECT COUNT(*) as count FROM orders` },
        { key: 'totalUsers', sql: `SELECT COUNT(*) as count FROM users WHERE role='customer'` },
        { key: 'totalRevenue', sql: `SELECT SUM(c.price_num) as total FROM orders o JOIN cars c ON o.car_id = c.id` },
    ];

    let done = 0;
    queries.forEach(({ key, sql }) => {
        db.get(sql, [], (err, row) => {
            stats[key] = err ? 0 : (row.count !== undefined ? row.count : row.total || 0);
            done++;
            if (done === queries.length) {
                // Recent orders
                db.all(`SELECT o.id, o.order_date, o.status, u.username, c.make, c.model, c.price FROM orders o JOIN users u ON o.user_id=u.id JOIN cars c ON o.car_id=c.id ORDER BY o.order_date DESC LIMIT 10`, [], (err, orders) => {
                    stats.recentOrders = err ? [] : orders;
                    res.json(stats);
                });
            }
        });
    });
});

// Get all orders (Admin only)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
    db.all(`SELECT o.*, u.username, c.make, c.model, c.price, c.image FROM orders o JOIN users u ON o.user_id=u.id JOIN cars c ON o.car_id=c.id ORDER BY o.order_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Update order delivery status (Admin only)
app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Order not found' });
        res.json({ message: 'Order status updated', status });
    });
});

// Update car availability status inline (Admin only)
app.patch('/api/admin/cars/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['available', 'sold', 'reserved'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }
    db.run(`UPDATE cars SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Car not found' });
        res.json({ message: 'Car status updated', status });
    });
});

// Get all users (Admin only)
app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all(`SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ─── AI ENDPOINTS ──────────────────────────────────────────────────────────────

// AI Chat with action triggers
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        return res.status(503).json({ error: 'AI service not configured. Please add your GEMINI_API_KEY to the .env file.' });
    }

    // Fetch cars for context
    db.all(`SELECT id, make, model, year, price, price_num, type, category, powertrain, features, description FROM cars WHERE status = 'available'`, [], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const inventory = rows.map(r => ({ ...r, features: safeParseJSON(r.features, []) }));

        // Fetch user preferences if logged in
        let userPrefs = '';
        if (req.session.userId) {
            const viewedCars = await new Promise(resolve => {
                db.all(`SELECT DISTINCT c.make, c.model, c.type, c.category FROM user_views uv JOIN cars c ON uv.car_id = c.id WHERE uv.user_id = ? ORDER BY uv.viewed_at DESC LIMIT 5`, [req.session.userId], (e, r) => resolve(r || []));
            });
            if (viewedCars.length > 0) {
                userPrefs = `\nUser recently viewed: ${viewedCars.map(c => `${c.make} ${c.model} (${c.type}, ${c.category})`).join(', ')}. Use this to personalize recommendations.`;
            }
        }

        const systemInstruction = `You are AutoAdvisor, an expert AI car advisor for AutoAI, a premium car dealership.
Your job is to help users find, compare, and decide on cars from our inventory using natural language.

INVENTORY (available cars only):
${JSON.stringify(inventory, null, 2)}
${userPrefs}

RESPONSE FORMAT: Always return a JSON object (not markdown) with this structure:
{
  "text": "Your friendly reply to the user",
  "action": null or one of: "SHOW_CAR", "OPEN_CHECKOUT", "FILTER_CARS", "COMPARE_CARS",
  "data": {} // action-specific data
}

ACTION RULES:
- "SHOW_CAR": Triggered when you want to highlight a specific car. data: { carId: number }
- "OPEN_CHECKOUT": Triggered when user says they want to buy a specific car. data: { carId: number }
- "FILTER_CARS": Triggered when user wants to see cars by type/category/powertrain. data: { type?: string, category?: string, powertrain?: string }
- "COMPARE_CARS": Triggered when user asks to compare cars. data: { carIds: [number, number] }

RULES:
1. Only recommend cars from the inventory list above.
2. Use natural, friendly, expert language.
3. If user asks for a car by type/budget/lifestyle, filter from inventory — never make up cars.
4. If the inventory is empty, inform the user politely.
5. Provide price when recommending.
6. Ask clarifying questions if request is too broad.
7. ALWAYS return valid JSON — no markdown fences, no extra text outside the JSON.`;

        const contents = [
            { role: 'user', parts: [{ text: systemInstruction }] },
            { role: 'model', parts: [{ text: '{"text": "Understood, I am ready to assist with the AutoAI inventory.", "action": null, "data": {}}' }] },
            ...(history || []),
            { role: 'user', parts: [{ text: message }] }
        ];

        try {
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
                })
            });

            const geminiData = await geminiRes.json();
            if (geminiData.error) return res.status(502).json({ error: geminiData.error.message });

            let aiResponse;
            try {
                const rawText = geminiData.candidates[0].content.parts[0].text;
                aiResponse = JSON.parse(rawText);
            } catch {
                aiResponse = { text: geminiData.candidates[0].content.parts[0].text, action: null, data: {} };
            }

            // Save to chat history if logged in
            if (req.session.userId) {
                db.run(`INSERT INTO chat_history (user_id, role, content) VALUES (?, 'user', ?)`, [req.session.userId, message]);
                db.run(`INSERT INTO chat_history (user_id, role, content) VALUES (?, 'model', ?)`, [req.session.userId, aiResponse.text]);
            }

            res.json(aiResponse);
        } catch (e) {
            res.status(500).json({ error: 'Failed to reach AI service: ' + e.message });
        }
    });
});

// AI Generate Stats & Description for a car (Admin)
app.post('/api/admin/generate-ai', requireAdmin, async (req, res) => {
    const { make, model, year, price, type, category, powertrain, features, mileage, color } = req.body;
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        return res.status(503).json({ error: 'AI service not configured. Please add your GEMINI_API_KEY to the .env file.' });
    }

    const prompt = `You are an expert automotive AI. Generate a compelling marketing description and key statistics for this car listing.

Car Details:
- Make: ${make}
- Model: ${model}
- Year: ${year || 'N/A'}
- Price: ${price}
- Type: ${type}
- Category: ${category}
- Powertrain: ${powertrain}
- Features: ${Array.isArray(features) ? features.join(', ') : features}
- Mileage: ${mileage || 'New'}
- Color: ${color || 'N/A'}

Return a JSON object ONLY (no markdown) with this exact structure:
{
  "description": "A 2-3 paragraph compelling, professional marketing description of this car",
  "statistics": {
    "performance_score": 85,
    "comfort_score": 78,
    "value_score": 90,
    "fuel_efficiency": "28 MPG",
    "0_to_60": "5.2 seconds",
    "horsepower": "250 HP",
    "depreciation": "15% per year",
    "pros": ["Pro 1", "Pro 2", "Pro 3", "Pro 4"],
    "cons": ["Con 1", "Con 2", "Con 3"],
    "best_for": ["Families", "Daily commuters"],
    "ai_verdict": "A short 1-sentence AI verdict on this car"
  }
}`;

    try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
            })
        });

        const geminiData = await geminiRes.json();
        if (geminiData.error) return res.status(502).json({ error: geminiData.error.message });

        const rawText = geminiData.candidates[0].content.parts[0].text;
        const aiResult = JSON.parse(rawText);
        res.json(aiResult);
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate AI content: ' + e.message });
    }
});

// AI Image Recognition — find similar cars by image URL
app.post('/api/ai/image-search', async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        return res.status(503).json({ error: 'AI service not configured.' });
    }

    db.all(`SELECT id, make, model, year, price, type, category, powertrain FROM cars WHERE status = 'available'`, [], async (err, inventory) => {
        if (err) return res.status(500).json({ error: err.message });

        const prompt = `You are an automotive AI. The user wants to find cars similar to the one in this image.
Based on what you can determine from the image (body style, size, type), identify the closest matches from this inventory:

${JSON.stringify(inventory, null, 2)}

Return a JSON object ONLY:
{
  "detected": "Brief description of the car type you see in the image",
  "matchedIds": [1, 3, 5],
  "explanation": "Brief explanation of why these cars match"
}

If you cannot determine the car type, return an empty matchedIds array.`;

        try {
            // Fetch image as base64 for Gemini vision
            let imagePart;
            try {
                const imgResponse = await fetch(imageUrl);
                if (!imgResponse.ok) throw new Error('Could not fetch image');
                const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                const buffer = await imgResponse.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                imagePart = { inlineData: { mimeType: contentType, data: base64 } };
            } catch {
                return res.status(400).json({ error: 'Could not load image from URL. Please check the URL.' });
            }

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });

            const geminiData = await geminiRes.json();
            if (geminiData.error) return res.status(502).json({ error: geminiData.error.message });

            const rawText = geminiData.candidates[0].content.parts[0].text;
            const result = JSON.parse(rawText);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: 'Image search failed: ' + e.message });
        }
    });
});

// ─── USER ORDERS ───────────────────────────────────────────────────────────────

// Checkout
app.post('/api/checkout', requireAuth, (req, res) => {
    const { carId, address, payment_method, notes } = req.body;
    if (!carId) return res.status(400).json({ error: 'Car ID is required' });

    const addressStr = address ? `${address.street}, ${address.city}, ${address.zip}` : null;

    db.get(`SELECT * FROM cars WHERE id = ? AND status = 'available'`, [carId], (err, car) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!car) return res.status(404).json({ error: 'Car not found or not available' });

        db.run(
            `INSERT INTO orders (user_id, car_id, address, payment_method, notes) VALUES (?, ?, ?, ?, ?)`,
            [req.session.userId, carId, addressStr, payment_method || 'card', notes || null],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                // Optionally mark car as sold
                // db.run(`UPDATE cars SET status='sold' WHERE id=?`, [carId]);
                res.json({ message: 'Order placed successfully!', orderId: this.lastID });
            }
        );
    });
});

// Get user orders
app.get('/api/orders/my', requireAuth, (req, res) => {
    db.all(
        `SELECT o.*, c.make, c.model, c.price, c.image FROM orders o JOIN cars c ON o.car_id = c.id WHERE o.user_id = ? ORDER BY o.order_date DESC`,
        [req.session.userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ─── ADMIN SERVE ───────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 AutoAI Server running on http://localhost:${PORT}`);
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        console.warn(`⚠️  WARNING: GEMINI_API_KEY not set in .env — AI features will be disabled.`);
    }
});
