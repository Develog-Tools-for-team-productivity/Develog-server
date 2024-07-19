import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import User from '../models/User.js';

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
      githubToken,
      selectedRepositories,
    });

    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    console.error('사용자 등록 중 오류가 발생했습니다:', err);
    res.status(500).json({ message: err.message });
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
