const express = require('express');
const shelvesRouter = require('./routes/shelves');
const leasesRouter = require('./routes/leases');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mount routes
app.use('/shelves', shelvesRouter);
app.use('/leases', leasesRouter);

app.get('/', (req, res) => {
  res.json({ message: 'FreshMart Cold Storage API is running' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
