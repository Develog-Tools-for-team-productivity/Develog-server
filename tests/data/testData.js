import mongoose from 'mongoose';

export const testData = {
  users: [
    {
      _id: new mongoose.Types.ObjectId(),
      githubToken: 'exampleToken',
      username: 'testUser1',
      userTeamName: 'devTeam',
      password: 'hashedPassword',
      profileImageUrl: 'https://picsum.photos/seed/picsum/200/300',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      githubToken: 'exampleToken2',
      username: 'testUser2',
      userTeamName: 'devTeam',
      password: 'hashedPassword2',
      profileImageUrl: 'https://picsum.photos/seed/picsum/200/300',
    },
  ],
  repositories: [
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'exampleRepo',
      repositoryId: new mongoose.Types.ObjectId(),
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
      totalCommits: 110,
      dailyDeployments: [
        { date: new Date('2023-01-01'), count: 5 },
        { date: new Date('2023-01-02'), count: 7 },
      ],
    },
  ],
  sprints: [
    {
      _id: new mongoose.Types.ObjectId(),
      repositoryId: new mongoose.Types.ObjectId(),
      name: 'Sprint 1',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-15'),
      teamMembers: ['testUser1', 'testUser2'],
      topLabels: [
        { name: 'bug', count: 50 },
        { name: 'feature', count: 32 },
        { name: 'improvement', count: 18 },
      ],
      otherLabelsCount: 12,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      repositoryId: new mongoose.Types.ObjectId(),
      name: 'Sprint 2',
      startDate: new Date('2023-02-01'),
      endDate: new Date('2023-02-15'),
      teamMembers: ['testUser1'],
      topLabels: [
        { name: 'bug', count: 25 },
        { name: 'feature', count: 20 },
        { name: 'improvement', count: 10 },
      ],
      otherLabelsCount: 5,
    },
  ],
  issues: [
    {
      _id: new mongoose.Types.ObjectId(),
      repositoryId: new mongoose.Types.ObjectId(),
      sprintId: new mongoose.Types.ObjectId(),
      title: 'Fix critical bug',
      status: 'done',
      labels: ['bug'],
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      closedAt: new Date('2023-01-02'),
      column: 'Done',
      isBug: true,
      mergedAt: new Date('2023-01-02'),
    },
  ],
  pullRequests: [
    {
      _id: new mongoose.Types.ObjectId(),
      repositoryId: new mongoose.Types.ObjectId(),
      title: 'Add new feature',
      repositoryName: 'exampleRepo',
      authors: [
        {
          username: 'testUser1',
          profileImageUrl: 'https://picsum.photos/seed/picsum/200/300',
        },
        {
          username: 'testUser2',
          profileImageUrl: 'https://picsum.photos/seed/picsum/200/300',
        },
      ],
      createdAt: new Date('2023-01-01'),
      firstCommitAt: new Date('2023-01-01'),
      prSubmittedAt: new Date('2023-01-02'),
      firstReviewAt: new Date('2023-01-03'),
      allApprovedAt: new Date('2023-01-04'),
      mergedAt: new Date('2023-01-05'),
      additions: 100,
      deletions: 50,
      commitCount: 5,
      reviewers: [
        {
          username: 'reviewer1',
          profileImageUrl: 'https://picsum.photos/seed/picsum/200/300',
        },
      ],
      reviews: [
        {
          reviewer: 'reviewer1',
          status: 'approved',
          submittedAt: new Date('2023-01-03'),
        },
      ],
      branchStatus: {
        activeBranchCount: 1,
        mergeStatus: {
          merged: 1,
          open: 0,
          closed: 0,
        },
      },
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
    },
  ],
  dailyStats: [
    {
      _id: new mongoose.Types.ObjectId(),
      repositoryId: new mongoose.Types.ObjectId(),
      date: new Date('2023-01-01'),
      totalCommits: 110,
      bugFixTime: 1440,
      pullRequests: [
        {
          username: 'testUser1',
          linesChanged: 150,
        },
        {
          username: 'testUser2',
          linesChanged: 200,
        },
      ],
    },
  ],
};
