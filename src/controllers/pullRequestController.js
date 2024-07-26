import { fetchGithubData, fetchPagedGithubData } from '../utils/api.js';
import PullRequest from '../models/PullRequest.js';

export async function processPullRequests(user, owner, repoName) {
  const githubToken = user.githubToken;
  let allPullRequests = [];

  try {
    const repoInfo = await fetchGithubData(
      `/repos/${owner}/${repoName}`,
      githubToken
    );
    const repositoryId = repoInfo.id.toString();

    const pullRequests = await fetchPagedGithubData(
      `/repos/${owner}/${repoName}/pulls`,
      githubToken,
      { state: 'all', per_page: 100 }
    );

    for (const pr of pullRequests) {
      const pullRequestData = {
        repositoryId,
        title: pr.title,
        repositoryName: repoName,
        author: [
          { username: pr.user.login, profileImageUrl: pr.user.avatar_url },
        ],
        createdAt: pr.created_at,
        firstCommitAt: await getFirstCommitDate(
          owner,
          repoName,
          pr.number,
          githubToken
        ),
        prSubmittedAt: pr.created_at,
        firstReviewAt: await getFirstReviewDate(
          owner,
          repoName,
          pr.number,
          githubToken
        ),
        allApprovedAt: await getAllApprovedDate(
          owner,
          repoName,
          pr.number,
          githubToken
        ),
        mergedAt: pr.merged_at,
        additions: pr.additions,
        deletions: pr.deletions,
        commitCount: await getCommitCount(
          owner,
          repoName,
          pr.number,
          githubToken
        ),
        reviews: await getReviews(owner, repoName, pr.number, githubToken),
        branchStatus: await getBranchStatus(owner, repoName, githubToken),
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
      };

      allPullRequests.push(pullRequestData);
    }

    await PullRequest.insertMany(allPullRequests);

    return {
      message: '풀 리퀘스트가 성공적으로 가져와지고 저장되었습니다',
      count: allPullRequests.length,
    };
  } catch (error) {
    console.error('Pull requests 처리 중 오류 발생:', error);
    throw error;
  }
}

async function getFirstCommitDate(owner, repoName, pullNumber, token) {
  try {
    const data = await fetchGithubData(
      `/repos/${owner}/${repoName}/pulls/${pullNumber}/commits`,
      token
    );
    if (data.length > 0) {
      return new Date(data[0].commit.committer.date);
    }
    return null;
  } catch (error) {
    console.error('첫 커밋 날짜를 가져오는 중 오류가 발생했습니다:', error);
    return null;
  }
}

async function getFirstReviewDate(owner, repoName, pullNumber, token) {
  try {
    const data = await fetchGithubData(
      `/repos/${owner}/${repoName}/pulls/${pullNumber}/reviews`,
      token
    );
    if (data.length > 0) {
      return new Date(data[0].submitted_at);
    }
    return null;
  } catch (error) {
    console.error('첫 리뷰 날짜를 가져오는 중 오류가 발생했습니다:', error);
    return null;
  }
}

async function getAllApprovedDate(owner, repoName, pullNumber, token) {
  try {
    const data = await fetchGithubData(
      `/repos/${owner}/${repoName}/pulls/${pullNumber}/reviews`,
      token
    );
    const approvals = data.filter(review => review.state === 'APPROVED');
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

async function getCommitCount(owner, repoName, pullNumber, token) {
  try {
    const data = await fetchGithubData(
      `/repos/${owner}/${repoName}/pulls/${pullNumber}/commits`,
      token
    );
    return data.length;
  } catch (error) {
    console.error('커밋 수를 가져오는 중 오류가 발생했습니다:', error);
    return 0;
  }
}

async function getReviews(owner, repoName, pullNumber, token) {
  try {
    const data = await fetchGithubData(
      `/repos/${owner}/${repoName}/pulls/${pullNumber}/reviews`,
      token
    );
    return data.map(review => ({
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

async function getBranchStatus(owner, repoName, token) {
  try {
    const branches = await fetchGithubData(
      `/repos/${owner}/${repoName}/branches`,
      token
    );
    const pulls = await fetchGithubData(
      `/repos/${owner}/${repoName}/pulls`,
      token,
      { state: 'all' }
    );

    return {
      activeBranchCount: branches.length,
      mergeStatus: {
        merged: pulls.filter(pr => pr.merged_at).length,
        open: pulls.filter(pr => pr.state === 'open').length,
        closed: pulls.filter(pr => pr.state === 'closed' && !pr.merged_at)
          .length,
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
