const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ==================== REGISTER ====================
router.post('/register', async (req, res) => {
  const { name, email, password, role, department } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
    }

    // Validate department
    const validDepartments = [
      'support team A',
      'software team',
      'network team',
      'infrastructure team',
      'hardware team',
      'database team'
    ];

    if (!department || !validDepartments.includes(department)) {
      return res.status(400).json({ errors: [{ msg: 'Invalid or missing department' }] });
    }

    // Create user
    user = new User({ name, email, password, role, department });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // JWT payload
    const payload = { user: { id: user.id } };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'jwt_secret_placeholder',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }

    // JWT payload
    const payload = { user: { id: user.id } };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'jwt_secret_placeholder',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
