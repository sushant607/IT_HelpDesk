require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const ai = require('./ai');

const app = express();
app.use(cors({
  origin: ['http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Connect DB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
// app.use('/api/users', require('./routes/users'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chatbot', require('./routes/chatbot'));

ai.setupChatbotRoutes(app);

// Health check
app.get('/api/health', (req, res) => res.json({status: 'ok'}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
