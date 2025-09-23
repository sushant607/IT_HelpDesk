// server.js
const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Dummy route
app.get('/', (req, res) => {
  res.send('Server is running! 🚀');
});

// Another test route
app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, Sushant!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});