import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema({
  repositoryId: String,
  name: String,
  startDate: Date,
  endDate: Date,
  teamMembers: [String],
  topLabels: [
    {
      name: String,
      count: Number,
    },
  ],
  otherLabelsCount: Number,
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
