import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema({
  repositoryId: String,
  repositoryName: String,
  projectId: String,
  projectName: String,
  name: String,
  startDate: Date,
  endDate: Date,
  issues: [
    {
      title: String,
      number: Number,
      state: String,
    },
  ],
});

sprintSchema.virtual('issue', {
  ref: 'Issue',
  localField: '_id',
  foreignField: 'sprintId',
});

sprintSchema.set('toJSON', { virtuals: true });
sprintSchema.set('toObject', { virtuals: true });

const Sprint = mongoose.model('Sprint', sprintSchema);

export default Sprint;
