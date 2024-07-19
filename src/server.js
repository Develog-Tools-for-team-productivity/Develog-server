import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors());

connectDB();

app.get('/', (req, res) => {
  res.send('연결되었습니다.');
});

app.use('/api', userRoutes);

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행되고 있습니다.`);
});
