require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Connected');
});

app.use('/api/users', userRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
