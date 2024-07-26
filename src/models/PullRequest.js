import mongoose from 'mongoose';

const pullRequestSchema = new mongoose.Schema({
  repositoryId: String,
  title: String,
  repositoryName: String,
  author: [
    {
      username: String,
      profileImageUrl: String,
    },
  ],
  createdAt: Date,
  firstCommitAt: Date,
  prSubmittedAt: Date,
  firstReviewAt: Date,
  allApprovedAt: Date,
  mergedAt: Date,
  additions: Number,
  deletions: Number,
  commitCount: Number,
  reviews: [
    {
      reviewer: String,
      status: String,
      submittedAt: Date,
      reviewers: [
        {
          username: String,
          profileImageUrl: String,
        },
      ],
    },
  ],
  branchStatus: {
    activeBranchCount: Number,
    mergeStatus: {
      merged: Number,
      open: Number,
      closed: Number,
    },
  },
  sourceBranch: String,
  targetBranch: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
});

const PullRequest = mongoose.model('PullRequest', pullRequestSchema);

export default PullRequest;
