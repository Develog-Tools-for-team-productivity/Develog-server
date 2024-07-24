import axios from 'axios';
import PullRequest from '../models/PullRequest.js';

export async function processPullRequests(repositoryName, githubToken) {
  const [owner, repo] = repositoryName.split('/');
  let page = 1;
  let allPullRequests = [];

  const repoInfo = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: { Authorization: `token ${githubToken}` },
    }
  );
  const repositoryId = repoInfo.data.id.toString();

  while (true) {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}`,
      { headers: { Authorization: `token ${githubToken}` } }
    );

    if (response.data.length === 0) break;

    for (const pr of response.data) {
      const pullRequestData = {
        repositoryId: repositoryId,
        title: pr.title,
        repositoryName: repositoryName,
        author: [
          { username: pr.user.login, profileImageUrl: pr.user.avatar_url },
        ],
        createdAt: pr.created_at,
        firstCommitAt: await getFirstCommitDate(
          owner,
          repo,
          pr.number,
          githubToken
        ),
        prSubmittedAt: pr.created_at,
        firstReviewAt: await getFirstReviewDate(
          owner,
          repo,
          pr.number,
          githubToken
        ),
        allApprovedAt: await getAllApprovedDate(
          owner,
          repo,
          pr.number,
          githubToken
        ),
        mergedAt: pr.merged_at,
        additions: pr.additions,
        deletions: pr.deletions,
        commitCount: await getCommitCount(owner, repo, pr.number, githubToken),
        reviews: await getReviews(owner, repo, pr.number, githubToken),
        branchStatus: await getBranchStatus(owner, repo, githubToken),
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
      };

      allPullRequests.push(pullRequestData);
    }

    page++;
  }

  await PullRequest.insertMany(allPullRequests);

  return {
    message: '풀 리퀘스트가 성공적으로 가져와지고 저장되었습니다',
    count: allPullRequests.length,
  };
}

async function getFirstCommitDate(owner, repo, pullNumber, token) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );
    if (response.data.length > 0) {
      return new Date(response.data[0].commit.committer.date);
    }
    return null;
  } catch (error) {
    console.error('첫 커밋 날짜를 가져오는 중 오류가 발생했습니다:', error);
    return null;
  }
}

async function getFirstReviewDate(owner, repo, pullNumber, token) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );
    if (response.data.length > 0) {
      return new Date(response.data[0].submitted_at);
    }
    return null;
  } catch (error) {
    console.error('첫 리뷰 날짜를 가져오는 중 오류가 발생했습니다:', error);
    return null;
  }
}

async function getAllApprovedDate(owner, repo, pullNumber, token) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );
    const approvals = response.data.filter(
      review => review.state === 'APPROVED'
    );
    if (approvals.length > 0) {
      return new Date(approvals[approvals.length - 1].submitted_at);
    }
    return null;
  } catch (error) {
    console.error(
      '모든 팀원의 승인 날짜를 가져오는 중 오류가 발생했습니다:',
      error
    );
    return null;
  }
}

async function getCommitCount(owner, repo, pullNumber, token) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );
    return response.data.length;
  } catch (error) {
    console.error('커밋 수를 가져오는 중 오류가 발생했습니다:', error);
    return 0;
  }
}

async function getReviews(owner, repo, pullNumber, token) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );

    return response.data.map(review => ({
      reviewer: review.user.login,
      status: review.state.toLowerCase(),
      submittedAt: new Date(review.submitted_at),
      reviewers: [
        {
          username: review.user.login,
          profileImageUrl: review.user.avatar_url,
        },
      ],
    }));
  } catch (error) {
    console.error('리뷰를 가져오는 중 오류가 발생했습니다:', error);
    return [];
  }
}

async function getBranchStatus(owner, repo, token) {
  try {
    const branchesResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );
    const pullsResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );

    return {
      activeBranchCount: branchesResponse.data.length,
      mergeStatus: {
        merged: pullsResponse.data.filter(pr => pr.merged_at).length,
        open: pullsResponse.data.filter(pr => pr.state === 'open').length,
        closed: pullsResponse.data.filter(
          pr => pr.state === 'closed' && !pr.merged_at
        ).length,
      },
    };
  } catch (error) {
    console.error('브랜치 상태를 가져오는 중 오류가 발생했습니다:', error);
    return {
      activeBranchCount: 0,
      mergeStatus: { merged: 0, open: 0, closed: 0 },
    };
  }
}
