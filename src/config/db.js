import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
    });
  } catch (err) {
    console.error('MongoDB 연결 중 오류가 발생했습니다:', err.message);
    process.exit(1);
  }
};

export default connectDB;
