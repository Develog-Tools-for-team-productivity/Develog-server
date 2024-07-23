import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: String,
  startDate: Date,
  endDate: Date,
  totalCommits: Number,
  dailyDeployments: [
    {
      date: Date,
      count: Number,
    },
  ],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const Project = mongoose.model('Project', projectSchema);

export default Project;
