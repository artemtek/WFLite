const express = require('express');
const app = express();
const port = 3000;

// Middleware for parsing JSON (if needed)
app.use(express.json());

// A sample route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});