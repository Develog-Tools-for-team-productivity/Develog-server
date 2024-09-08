import fetch from 'node-fetch';
import Issue from '../models/Issue.js';
import Project from '../models/Project.js';

const GITHUB_API_ENDPOINT = 'https://api.github.com/graphql';
const projectQuery = `
  query($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      id
      name
      projectsV2(first: 1) {
        nodes {
          id
          title
          items(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              content {
                ... on Issue {
                  id
                  number
                  title
                  state
                  createdAt
                  closedAt
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                  author {
                    login
                    avatarUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchGithubGraphQL(token, query, variables) {
  try {
    const response = await fetch(GITHUB_API_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('GitHub GraphQL API 요청 실패:', error);
    throw error;
  }
}

function mapNodeToIssue(node) {
  const issue = node.content;
  if (!issue) {
    console.error('유효하지 않은 노드 구조:', node);
    return null;
  }

  return {
    id: issue.id,
    title: issue.title,
    number: issue.number,
    state: issue.state,
    created_at: issue.createdAt ? new Date(issue.createdAt) : new Date(),
    closed_at: issue.closedAt ? new Date(issue.closedAt) : null,
    labels: issue.labels ? issue.labels.nodes.map(label => label.name) : [],
    author: {
      login: issue.author?.login || 'Unknown',
      avatarUrl: issue.author?.avatarUrl || '',
    },
  };
}

async function fetchProjectIssues(owner, repo, token) {
  let hasNextPage = true;
  let cursor = null;
  const allIssues = [];

  while (hasNextPage) {
    const data = await fetchGithubGraphQL(token, projectQuery, {
      owner,
      repo,
      cursor,
    });

    const repository = data.repository;
    if (
      !repository ||
      !repository.projectsV2 ||
      !repository.projectsV2.nodes.length
    ) {
      console.error('Invalid GraphQL response structure:', data);
      break;
    }

    const project = repository.projectsV2.nodes[0];
    if (!project || !project.items || !project.items.nodes.length) {
      console.error('No items found in project:', project);
      break;
    }

    const issues = project.items.nodes
      .map(mapNodeToIssue)
      .filter(issue => issue !== null);

    allIssues.push(...issues);

    hasNextPage = project.items.pageInfo.hasNextPage;
    cursor = project.items.pageInfo.endCursor;
  }

  return allIssues;
}

async function createIssueObject(
  issueData,
  repositoryId,
  projectId,
  projectStatus,
  projectStartDate,
  projectEndDate
) {
  return new Issue({
    repositoryId,
    title: issueData.title,
    status: issueData.state,
    labels: issueData.labels || [],
    createdAt: issueData.created_at
      ? new Date(issueData.created_at)
      : new Date(),
    closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
    isBug: issueData.labels
      ? issueData.labels.some(label => label.toLowerCase() === 'bug')
      : false,
    projectId,
    projectStatus,
    projectStartDate,
    projectEndDate,
    number: issueData.number,
    author: {
      login: issueData.author.login || '',
      avatarUrl: issueData.author.avatarUrl || '',
    },
  });
}

async function processIssue(issueData, repositoryId, projectId) {
  if (issueData.pull_request) return;

  const projectStatus = issueData.state;
  const projectDates = {
    startDate: issueData.created_at ? new Date(issueData.created_at) : null,
    endDate: issueData.closed_at ? new Date(issueData.closed_at) : null,
  };

  const issue = await createIssueObject(
    issueData,
    repositoryId,
    projectId,
    projectStatus,
    projectDates.startDate,
    projectDates.endDate
  );
  await issue.save();
}

export async function processIssues(user, owner, repo) {
  console.log('웹훅 실행 확인 로그');
  const githubToken = user.githubToken;

  if (!githubToken) {
    throw new Error('GitHub 토큰이 없습니다.');
  }

  try {
    const existingProject = await Project.findOne({
      userId: user._id,
      name: repo,
    });

    if (!existingProject) {
      throw new Error(`Project ${repo} not found for user ${user._id}`);
    }

    const issues = await fetchProjectIssues(owner, repo, githubToken);

    for (const issueData of issues) {
      await processIssue(issueData, existingProject._id, existingProject._id);
    }

    console.log(`${repo}의 이슈 ${issues.length}개를 성공적으로 불러왔습니다.`);
  } catch (error) {
    console.error('이슈 처리 중 오류 발생:', error);
    throw error;
  }
}
