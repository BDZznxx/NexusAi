/**
 * NEXUS AI - Authentication Routes
 * Handles user authentication and authorization
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// In-memory user database (replace with real DB)
const users = new Map();
const refreshTokens = new Map();

// Default admin user
users.set('admin@nexus.ai', {
  id: 'admin',
  email: 'admin@nexus.ai',
  password: '$2a$10$XQxQ.xQxQ.xQxQ.xQxQ.xQxQ.xQxQ.xQxQ.xQxQ.xQxQ.xQxQ', // password
  name: 'Admin User',
  role: 'admin',
  plan: 'unlimited',
  createdAt: new Date().toISOString()
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (users.has(email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const user = {
      id: userId,
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      role: 'user',
      plan: 'free',
      createdAt: new Date().toISOString()
    };

    users.set(email, user);

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan
      },
      token,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    refreshTokens.set(refreshToken, user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        avatar: user.name.charAt(0).toUpperCase()
      },
      token,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshTokens.has(refreshToken)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = refreshTokens.get(refreshToken);
    const user = Array.from(users.values()).find(u => u.id === userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    refreshTokens.delete(refreshToken);
    refreshTokens.set(newRefreshToken, user.id);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken && refreshTokens.has(refreshToken)) {
      refreshTokens.delete(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify token
router.get('/verify', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Get profile
router.get('/profile', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const userEmail = req.user.email;
    const user = users.get(userEmail);

    if (user) {
      if (name) user.name = name;
      if (avatar) user.avatar = avatar;
      users.set(userEmail, user);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats
router.get('/stats', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    stats: {
      totalRequests: 12847,
      tokensUsed: 380000,
      tokensLimit: 1000000,
      plan: req.user.plan || 'free',
      daysActive: 30
    }
  });
});

// Helper functions
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '1h' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;