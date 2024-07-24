import mongoose from 'mongoose';

const DailyStatsSchema = new mongoose.Schema({
  repositoryId: String,
  date: Date,
  totalCommits: Number,
  bugFixTime: Number,
});

const DailyStats = mongoose.model('DailyStats', DailyStatsSchema);

export default DailyStats;
