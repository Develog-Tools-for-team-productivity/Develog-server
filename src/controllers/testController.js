const Test = require('../models/Test');

exports.createTest = async (req, res) => {
  const { name } = req.body;
  const newTest = new Test({ name });
  try {
    const savedTest = await newTest.save();
    res.status(201).json(savedTest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTests = async (req, res) => {
  try {
    const tests = await Test.find();
    res.status(200).json(tests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
