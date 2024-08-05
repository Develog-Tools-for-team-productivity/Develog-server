import PullRequest from '../models/PullRequest.js';
import Issue from '../models/Issue.js';
import { getDailyCommits } from './getDailyCommits.js';

const collectPullRequests = async (project, startDate, endDate) => {
  return await PullRequest.find({
    repositoryId: project._id,
    createdAt: { $gte: startDate, $lte: endDate },
  });
};

const collectIssues = async (project, startDate, endDate) => {
  return await Issue.find({
    repositoryId: project._id,
    createdAt: { $gte: startDate, $lte: endDate },
  });
};

const collectCommits = async (project, githubToken, startDate, endDate) => {
  const [owner, repo] = project.fullName.split('/');
  return await getDailyCommits(owner, repo, githubToken, startDate, endDate);
};

export const collectProjectData = async (
  project,
  startDate,
  endDate,
  githubToken
) => {
  let pullRequests = [];
  let commits = 0;
  let issues = [];

  try {
    pullRequests = await collectPullRequests(project, startDate, endDate);
    commits = await collectCommits(project, githubToken, startDate, endDate);
    issues = await collectIssues(project, startDate, endDate);
  } catch (error) {
    console.error(`프로젝트 ${project.fullName} 데이터 수집 중 오류:`, error);
  }

  return { pullRequests, commits, issues };
};
