require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

connectDB().catch(err => {
  console.error('데이터베이스 연결 실패:', err);
});

app.use(express.json());

app.use(
  cors({
    origin: 'https://develog-tools.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.options('*', cors());

app.get('/', (req, res) => {
  res.send('Connected');
});

app.use('/api', userRoutes);

app.use((req, res, next) => {
  res.status(404).json({ message: '요청한 리소스를 찾을 수 없습니다.' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
});

app
  .listen(PORT, () => {
    console.log(`서버가 ${PORT} 포트에서 실행 중입니다.`);
  })
  .on('error', err => {
    console.error('서버 시작 실패:', err);
  });
