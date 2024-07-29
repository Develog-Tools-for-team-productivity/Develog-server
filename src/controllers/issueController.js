import mongoose from 'mongoose';
import Issue from '../models/Issue.js';
import Sprint from '../models/Sprint.js';
import Project from '../models/Project.js';
import { fetchGithubData, fetchPagedGithubData } from '../utils/api.js';

const getRepoInfo = async (owner, repo, token) => {
  const data = await fetchGithubData(`/repos/${owner}/${repo}`, token);
  return data.id.toString();
};

const findSprintForIssue = async issueDate => {
  const sprint = await Sprint.findOne({
    startDate: { $lte: new Date(issueDate) },
    endDate: { $gte: new Date(issueDate) },
  });
  return sprint ? sprint.name : 'Backlog';
};

const createIssueObject = async (issueData, repositoryId, sprintName) => {
  return new Issue({
    repositoryId,
    sprintName,
    title: issueData.title,
    status: issueData.state,
    labels: issueData.labels.map(label => label.name),
    createdAt: new Date(issueData.created_at),
    closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
    isBug: issueData.labels.some(label => label.name.toLowerCase() === 'bug'),
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprints' },
  });
};

const processIssue = async (issueData, repositoryId) => {
  if (issueData.pull_request) return;

  const sprintName = await findSprintForIssue(issueData.created_at);
  const issue = await createIssueObject(issueData, repositoryId, sprintName);
  await issue.save();
};

export async function processIssues(user, owner, repo) {
  const githubToken = user.githubToken;

  if (!githubToken) {
    throw new Error('GitHub 토큰이 없습니다.');
  }

  try {
    const existingProject = await Project.findOne({
      userId: user._id,
      name: repo,
    });

    const repositoryId = existingProject._id;

    const issues = await fetchPagedGithubData(
      `/repos/${owner}/${repo}/issues`,
      githubToken,
      { state: 'all', per_page: 100 }
    );

    for (const issueData of issues) {
      await processIssue(issueData, repositoryId);
    }
  } catch (error) {
    console.error('이슈 처리 중 오류 발생:', error);
    throw error;
  }
}
