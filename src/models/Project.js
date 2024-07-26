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

projectSchema.virtual('dailyStats', {
  ref: 'DailyStats',
  localField: '_id',
  foreignField: 'projectId',
});

projectSchema.virtual('pullRequests', {
  ref: 'PullRequest',
  localField: '_id',
  foreignField: 'projectId',
});

projectSchema.virtual('sprints', {
  ref: 'Sprint',
  localField: '_id',
  foreignField: 'projectId',
});

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

const Project = mongoose.model('Project', projectSchema);

export default Project;
