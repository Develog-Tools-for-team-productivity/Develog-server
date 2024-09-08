import { fetchGraphQLData } from '../utils/api.js';
import Sprint from '../models/Sprint.js';
import Project from '../models/Project.js';

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
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldIterationValue {
                    title
                    startDate
                    duration
                  }
                }
              }
              content {
                ... on Issue {
                  title
                  number
                  state
                }
              }
            }
          }
        }
      }
    }
  }
`;

const fetchAllItems = async (owner, repo, githubToken) => {
  let allItems = [];
  let hasNextPage = true;
  let cursor = null;
  let repositoryInfo = null;

  try {
    while (hasNextPage) {
      const variables = { owner, repo, cursor };
      const response = await fetchGraphQLData(
        projectQuery,
        variables,
        githubToken
      );

      if (!response?.repository?.projectsV2?.nodes[0]) {
        throw new Error(
          'GraphQL 요청 실패 또는 응답 데이터가 올바르지 않습니다.'
        );
      }

      if (!repositoryInfo) {
        const { id, name, projectsV2 } = response.repository;
        repositoryInfo = {
          id,
          name,
          projectId: projectsV2.nodes[0].id,
          projectName: projectsV2.nodes[0].title,
        };
      }

      const project = response.repository.projectsV2.nodes[0];
      allItems = allItems.concat(project.items.nodes);
      hasNextPage = project.items.pageInfo.hasNextPage;
      cursor = project.items.pageInfo.endCursor;
    }

    return { allItems, repositoryInfo };
  } catch (error) {
    console.error('fetchAllItems 함수 실행 중 오류 발생:', error.message);
    throw new Error(
      `데이터를 가져오는 중 오류가 발생했습니다: ${error.message}`
    );
  }
};

const processItem = (item, sprintMap) => {
  if (!item.fieldValues?.nodes) {
    console.error(
      `Field values or nodes are missing for item: ${JSON.stringify(item)}`
    );
    return;
  }

  const sprintInfo = item.fieldValues.nodes.find(
    field => field.title && field.startDate
  );
  if (!sprintInfo) return;

  const { title, startDate, duration } = sprintInfo;
  if (!sprintMap.has(title)) {
    sprintMap.set(title, {
      name: title,
      startDate: new Date(startDate),
      endDate: new Date(
        new Date(startDate).getTime() + duration * 24 * 60 * 60 * 1000
      ),
      issues: [],
    });
  }
  const sprint = sprintMap.get(title);

  if (item.content?.title) {
    sprint.issues.push({
      title: item.content.title,
      number: item.content.number,
      state: item.content.state,
    });
  }
};

const prepareSprintData = (sprintMap, repositoryInfo, projectInDb) => {
  return Array.from(sprintMap.values()).map(sprint => ({
    repositoryId: repositoryInfo.id,
    repositoryName: repositoryInfo.name,
    projectId: projectInDb._id,
    projectName: repositoryInfo.projectName,
    name: sprint.name,
    issues: sprint.issues,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
  }));
};

export const processSprints = async (user, owner, repo) => {
  console.log('웹훅 실행 확인 로그');
  try {
    const { allItems, repositoryInfo } = await fetchAllItems(
      owner,
      repo,
      user.githubToken
    );

    if (allItems.length === 0) {
      console.log('저장할 스프린트 데이터가 없습니다.');
      return [];
    }

    const sprintMap = new Map();
    allItems.forEach(item => processItem(item, sprintMap));

    const projectInDb = await Project.findOne({ fullName: `${owner}/${repo}` });
    if (!projectInDb) {
      throw new Error(
        '해당 GitHub 프로젝트에 매칭되는 MongoDB 프로젝트가 없습니다.'
      );
    }

    const processedSprints = prepareSprintData(
      sprintMap,
      repositoryInfo,
      projectInDb
    );

    if (processedSprints.length > 0) {
      await Sprint.insertMany(processedSprints);
    } else {
      console.log('저장할 스프린트 데이터가 없습니다.');
    }

    return processedSprints;
  } catch (error) {
    console.error('오류가 발생했습니다:', error);
    throw error;
  }
};
