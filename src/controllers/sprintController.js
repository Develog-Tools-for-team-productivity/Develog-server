import axios from 'axios';
import Sprint from '../models/Sprint.js';

export const processSprints = async (owner, repo, githubToken) => {
  const graphqlEndpoint = 'https://api.github.com/graphql';

  const fetchGraphQLData = async (query, variables) => {
    const response = await axios.post(
      graphqlEndpoint,
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  };

  try {
    const projectQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          projectsV2(first: 1) {
            nodes {
              id
              title
              fields(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2IterationField {
                    id
                    name
                    configuration {
                      iterations {
                        id
                        title
                        startDate
                        duration
                      }
                    }
                  }
                  ... on ProjectV2Field {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
    const projectVariables = { owner, repo };
    const { repository } = await fetchGraphQLData(
      projectQuery,
      projectVariables
    );

    if (!repository.projectsV2.nodes.length) {
      return [];
    }

    const project = repository.projectsV2.nodes[0];

    const iterationField = project.fields.nodes.find(
      field => field.__typename === 'ProjectV2IterationField'
    );
    if (!iterationField) {
      return [];
    }

    const sprints = iterationField.configuration.iterations.map(iteration => ({
      repositoryId: repository.id,
      name: iteration.title,
      startDate: new Date(iteration.startDate),
      endDate: new Date(
        new Date(iteration.startDate).getTime() +
          iteration.duration * 24 * 60 * 60 * 1000
      ),
      teamMembers: new Set(),
      labels: {},
    }));

    const itemsQuery = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                fieldValues(first: 8) {
                  nodes {
                    ... on ProjectV2ItemFieldIterationValue {
                      iterationId
                    }
                  }
                }
                content {
                  ... on Issue {
                    title
                    number
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 10) {
                      nodes {
                        name
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
    const itemsVariables = { projectId: project.id };
    const { node: projectData } = await fetchGraphQLData(
      itemsQuery,
      itemsVariables
    );

    if (!projectData.items.nodes.length) {
      return [];
    }

    projectData.items.nodes.forEach(item => {
      const iterationId = item.fieldValues.nodes.find(
        fv => fv.iterationId
      )?.iterationId;
      const sprint = sprints.find(
        s =>
          s.name ===
          iterationField.configuration.iterations.find(
            i => i.id === iterationId
          )?.title
      );

      if (sprint && item.content) {
        item.content.assignees.nodes.forEach(assignee => {
          sprint.teamMembers.add(assignee.login);
        });
        item.content.labels.nodes.forEach(label => {
          sprint.labels[label.name] = (sprint.labels[label.name] || 0) + 1;
        });
      }
    });

    const processedSprints = sprints.map(sprint => ({
      _id: sprint._id,
      repositoryId: sprint.repositoryId,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      teamMembers: Array.from(sprint.teamMembers),
      topLabels: Object.entries(sprint.labels)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      otherLabelsCount: Math.max(Object.keys(sprint.labels).length - 3, 0),
    }));

    if (processedSprints.length > 0) {
      const result = await Sprint.insertMany(processedSprints);
    } else {
      console.log('저장할 스프린트 데이터가 없습니다.');
    }

    return processedSprints;
  } catch (error) {
    console.error(
      '오류가 발생했습니다:',
      error.response?.data || error.message
    );
    throw error;
  }
};
