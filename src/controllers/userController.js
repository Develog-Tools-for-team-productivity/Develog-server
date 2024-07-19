const bcrypt = require('bcrypt');
const User = require('../models/User');

exports.registerUser = async (req, res) => {
  const { email, password, teamName, githubToken } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      password: hashedPassword,
      teamName,
      githubToken,
    });

    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    console.error('Error occurred during user registration:', err);
    res.status(500).json({ message: err.message });
  }
};
