import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running with ES modules and ESLint! 🚀');
});

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, Sushant!' });
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});