const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database'); // Your database connection

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret-key'; // Use environment variable in production

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Please provide username, password, and role.' });
  }

  if (!['student', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Role must be either "student" or "admin".' });
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  const sql = `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`;
  db.run(sql, [username, password_hash, role], function(err) {
    if (err) {
      // Check for unique constraint violation (username already exists)
      if (err.message.includes('UNIQUE constraint failed: users.username')) {
        return res.status(409).json({ message: 'Username already exists.' });
      }
      console.error(err.message);
      return res.status(500).json({ message: 'Error registering user.' });
    }
    res.status(201).json({ message: 'User registered successfully.', userId: this.lastID });
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password.' });
  }

  const sql = `SELECT * FROM users WHERE username = ?`;
  db.get(sql, [username], (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error logging in.' });
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' }); // User not found
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' }); // Password does not match
    }

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: 'Error generating token.' });
      }
      res.json({ message: 'Logged in successfully.', token: token });
    });
  });
});

module.exports = router;
