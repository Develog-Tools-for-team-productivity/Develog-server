require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');

dotenv.config();

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
  console.log(`서버가 ${PORT} 포트에서 실행 중입니다.`);
});
