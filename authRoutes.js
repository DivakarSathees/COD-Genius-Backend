require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const mongoClient = new MongoClient(process.env.MONGO_URI);
const dbName = 'aiMemoryDB';
const JWT_SECRET = process.env.JWT_SECRET || 'cod_genius_jwt_secret_2024';
const JWT_EXPIRES = '8h';

async function getUsersCollection() {
    if (!mongoClient.topology || !mongoClient.topology.isConnected()) {
        await mongoClient.connect();
    }
    return mongoClient.db(dbName).collection('users');
}

// Seed default admin user on first run
async function seedDefaultAdmin() {
    const col = await getUsersCollection();
    const exists = await col.findOne({ username: 'divakar' });
    if (!exists) {
        const hashed = await bcrypt.hash('Divakar123', 10);
        await col.insertOne({
            username: 'divakar',
            name: 'Divakar',
            password: hashed,
            role: 'admin',
            createdAt: new Date(),
        });
        console.log('[Auth] Default admin seeded — username: Divakar, password: Divakar123');
    }
}
seedDefaultAdmin().catch(console.error);

// POST /auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    try {
        const col = await getUsersCollection();
        const user = await col.findOne({ username: username.toLowerCase().trim() });
        // console.log(user);
        
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

        const match = await bcrypt.compare(password, user.password);
        // console.log(match);
        
        if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign(
            { userId: user._id.toString(), username: user.username, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({ token, user: { username: user.username, name: user.name, role: user.role } });
    } catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /auth/register
router.post('/register', async (req, res) => {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'username, password and name are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    try {
        const col = await getUsersCollection();
        const existing = await col.findOne({ username: username.toLowerCase().trim() });
        if (existing) return res.status(409).json({ error: 'Username already taken.' });

        const hashed = await bcrypt.hash(password, 10);
        await col.insertOne({
            username: username.toLowerCase().trim(),
            name,
            password: hashed,
            role: 'user',
            createdAt: new Date(),
        });
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        console.error('[Auth] Register error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /auth/verify — lightweight token check
router.post('/verify', (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ valid: false });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        res.json({ valid: true, user: { username: payload.username, name: payload.name, role: payload.role } });
    } catch {
        res.status(401).json({ valid: false });
    }
});

module.exports = { router, JWT_SECRET };
