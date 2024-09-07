import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import User from '../src/models/User.js';
import Repository from '../src/models/Repository.js';
import PullRequest from '../src/models/PullRequest.js';
import Issue from '../src/models/Issue.js';
import { testData } from '../tests/data/testData.js';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  await User.insertMany(testData.users);
  await Repository.insertMany(testData.repositories);
  await PullRequest.insertMany(testData.pullRequests);
  await Issue.insertMany(testData.issues);
});

afterEach(async () => {
  await mongoose.connection.db.close();
});

describe('Dashboard Api', () => {
  it('should fetch dashboard data', async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .expect('Content-Type', /json/)
      .expect(200);

    const data = response.body;

    const allTeamMembers = testData.sprints.flatMap(
      sprint => sprint.teamMembers
    );
    const uniqueTeamMembers = [...new Set(allTeamMembers)];
    const totalMembers = uniqueTeamMembers.length;

    expect(data.projectCommitCount).toBe(testData.repositories[0].totalCommits);
    expect(data.totalMember).toBe(totalMembers);
    expect(data.topLabels).toEqual(
      expect.arrayContaining([
        { name: 'bug', count: 50 },
        { name: 'feature', count: 32 },
        { name: 'improvement', count: 18 },
        { name: 'other', count: 12 },
      ])
    );
    expect(data.totalProjects).toBe(testData.repositories.length);
    expect(data.bugIssueCount).toBe(
      testData.issues.filter(issue => issue.isBug).length
    );
  });
});
