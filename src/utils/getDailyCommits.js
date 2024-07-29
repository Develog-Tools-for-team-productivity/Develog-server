import { fetchGithubData } from '../utils/api.js';

export const getDailyCommits = async (owner, repo, token, since, until) => {
  try {
    let page = 1;
    let allCommits = [];
    const perPage = 100;

    while (true) {
      const url = `repos/${owner}/${repo}/commits`;
      const params = {
        since: since.toISOString(),
        until: until.toISOString(),
        per_page: perPage,
        page: page,
      };

      const commits = await fetchGithubData(url, token, params);

      if (commits.length === 0) break;

      allCommits = allCommits.concat(commits);
      page++;
    }

    return allCommits.length;
  } catch (error) {
    console.error(
      `커밋을 가져오는 동안 에러가 생겼습니다. ${owner}/${repo}:`,
      error
    );
    return 0;
  }
};
