import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';

import User from '../models/User.js';
import Project from '../models/Project.js';

const secretKey = process.env.SECRET_KEY;

export const registerUser = async (req, res) => {
  const { email, password, teamName, githubToken, selectedRepositories } =
    req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      password: hashedPassword,
      teamName,
      githubToken: await bcrypt.hash(githubToken, 10),
      selectedRepositories,
    });

    const savedUser = await newUser.save();

    const projects = await Promise.all(
      selectedRepositories.map(async repo => {
        try {
          const repoInfo = await getRepositoryInfo(repo.full_name, githubToken);
          const newProject = new Project({
            name: repoInfo.name,
            startDate: repoInfo.startDate,
            endDate: repoInfo.endDate,
            totalCommits: repoInfo.totalCommits,
            dailyDeployments: repoInfo.dailyDeployments,
            userId: savedUser._id,
          });
          return await newProject.save();
        } catch (error) {
          console.error('프로젝트 저장 중 오류가 발생했습니다.', error);
          return null;
        }
      })
    );

    const validProjects = projects.filter(project => project !== null);

    res.status(201).json({ user: savedUser, projects: validProjects });
  } catch (err) {
    console.error('사용자 등록 중 오류가 발생했습니다:', err);
  }
};

export const getRepositoryInfo = async (repoFullName, githubToken) => {
  try {
    const [owner, repo] = repoFullName.split('/');

    const repoResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: { Authorization: `token ${githubToken}` },
      }
    );
    const name = repoResponse.data.name;
    const startDate = new Date(repoResponse.data.created_at);
    let endDate = startDate;
    let totalCommits = 0;
    let commitPage = 1;
    let hasNextCommitPage = true;
    while (hasNextCommitPage) {
      const commitsResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${commitPage}`,
        {
          headers: { Authorization: `token ${githubToken}` },
        }
      );
      totalCommits += commitsResponse.data.length;
      hasNextCommitPage = commitsResponse.data.length === 100;
      commitPage++;
    }

    let dailyDeployments = {};
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const prResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&base=main&per_page=100&page=${page}`,
        {
          headers: { Authorization: `token ${githubToken}` },
        }
      );

      for (const pr of prResponse.data) {
        if (pr.merged_at) {
          const mergeDate = new Date(pr.merged_at);
          const branchName = pr.head.ref;

          const compareResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/compare/${pr.base.sha}...${pr.head.sha}`,
            {
              headers: { Authorization: `token ${githubToken}` },
            }
          );

          const branchCommits = compareResponse.data.total_commits;

          const dateKey = mergeDate.toISOString().split('T')[0];
          if (!dailyDeployments[dateKey]) {
            dailyDeployments[dateKey] = {
              date: mergeDate,
              count: 0,
              branchNames: new Set(),
            };
          }
          dailyDeployments[dateKey].count += branchCommits;
          dailyDeployments[dateKey].branchNames.add(branchName);

          if (mergeDate > endDate) {
            endDate = mergeDate;
          }
        }
      }

      hasNextPage = prResponse.data.length === 100;
      page++;
    }

    dailyDeployments = Object.values(dailyDeployments).map(deploy => ({
      date: deploy.date,
      count: deploy.count,
      branchName: Array.from(deploy.branchNames).join(', '),
    }));

    const result = {
      name,
      startDate,
      endDate,
      totalCommits,
      dailyDeployments,
    };

    return result;
  } catch (error) {
    console.error(
      '레포지토리 정보 가져오기 오류:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json({ message: '유효하지 않은 이메일 또는 비밀번호입니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ message: '유효하지 않은 이메일 또는 비밀번호입니다.' });
    }

    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: '1h',
    });
    res.json({ token, message: '로그인에 성공했습니다.' });
  } catch (err) {
    console.error('로그인 중 오류가 발생했습니다:', err);
    res.status(500).json({ message: err.message });
  }
};

export const fetchRepositories = async (req, res) => {
  const { githubToken } = req.body;

  try {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${githubToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('레포지토리 가져오기에 실패했습니다.');
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('레포지토리 가져오는 중 오류가 발생했습니다:', error);
    res.status(500).json({ message: error.message });
  }
};
