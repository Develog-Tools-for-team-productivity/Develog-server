import mongoose from 'mongoose';

const IssueSchema = new mongoose.Schema({
  repositoryId: String,
  sprintName: String,
  title: String,
  status: String,
  labels: [String],
  createdAt: Date,
  closedAt: Date,
  isBug: Boolean,
});

const Issue = mongoose.model('Issue', IssueSchema);

export default Issue;
