import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    sparse: true,
  },
  githubId: {
    type: String,
    required: true,
    unique: true,
  },
  teamName: String,
  githubToken: String,
  selectedRepositories: [],
});

userSchema.virtual('projects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'userId',
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;
