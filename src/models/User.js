import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  teamName: {
    type: String,
    required: true,
  },
  githubToken: {
    type: String,
    required: true,
  },
  selectedRepositories: {
    type: Array,
    required: true,
  },
});

const User = mongoose.model('User', userSchema);

export default User;
