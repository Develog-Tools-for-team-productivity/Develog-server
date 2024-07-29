import axios from 'axios';
import { handleApiError } from '../utils/handleApiError.js';

export const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github.v3+json',
  },
});

export const fetchGithubData = async (url, token, params = {}) => {
  try {
    const response = await githubApi.get(url, {
      headers: { Authorization: `token ${token}` },
      params,
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

export const fetchGraphQLData = async (query, variables, token) => {
  const graphqlEndpoint = 'https://api.github.com/graphql';
  try {
    const response = await axios.post(
      graphqlEndpoint,
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  } catch (error) {
    handleApiError(error);
  }
};

export const fetchPagedGithubData = async (url, token, params = {}) => {
  let page = 1;
  let results = [];

  while (true) {
    const data = await fetchGithubData(url, token, { ...params, page });
    if (data.length === 0) break;
    results = results.concat(data);
    page++;
  }

  return results;
};
