import mongoose from 'mongoose';

const IssueSchema = new mongoose.Schema({
  repositoryId: String,
  title: String,
  status: String,
  labels: [String],
  createdAt: Date,
  closedAt: Date,
  isBug: Boolean,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectStatus: String,
  projectStartDate: Date,
  projectEndDate: Date,
  number: Number,
  author: {
    login: String,
    avatarUrl: String,
  },
});

const Issue = mongoose.model('Issue', IssueSchema);

export default Issue;
