const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Simple rule-based chatbot endpoint
router.post('/', auth, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ reply: "I didn't receive a message." });
  const lower = message.toLowerCase();
  let reply = "Sorry, I don't understand. Please provide more details.";
  if (lower.includes('network')) reply = "Please check your router and try restarting it. If the problem persists, create a ticket with details.";
  else if (lower.includes('hardware')) reply = "For hardware issues, please include device model and serial number. I can create a ticket for you.";
  else if (lower.includes('password')) reply = "You can reset your password from the profile page or request admin assistance.";
  else if (lower.includes('ticket')) reply = "You can create a ticket via the /api/tickets endpoint or the New Ticket page in the app.";
  else reply = `Echo: ${message}`;
  res.json({ reply });
});

module.exports = router;
