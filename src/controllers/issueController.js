import axios from 'axios';
import Issue from '../models/Issue.js';
import Sprint from '../models/Sprint.js';

export async function processIssues(owner, repo, githubToken) {
  try {
    const repoResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    const repositoryId = repoResponse.data.id.toString();

    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          params: {
            state: 'all',
            per_page: 100,
            page: page,
          },
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      for (const issueData of response.data) {
        if (issueData.pull_request) continue;

        const sprintName = await findSprintForIssue(issueData.created_at);

        const issue = new Issue({
          repositoryId: repositoryId,
          sprintName,
          title: issueData.title,
          status: issueData.state,
          labels: issueData.labels.map(label => label.name),
          createdAt: new Date(issueData.created_at),
          closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
          isBug: issueData.labels.some(
            label => label.name.toLowerCase() === 'bug'
          ),
        });

        await issue.save();
      }

      hasNextPage = response.data.length === 100;
      page++;
    }
  } catch (error) {
    console.error('이슈 처리 중 오류 발생:', error);
    throw error;
  }
}

async function findSprintForIssue(issueDate) {
  const sprint = await Sprint.findOne({
    startDate: { $lte: new Date(issueDate) },
    endDate: { $gte: new Date(issueDate) },
  });

  return sprint ? sprint.name : 'Backlog';
}
