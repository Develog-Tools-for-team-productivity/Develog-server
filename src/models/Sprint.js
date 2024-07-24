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

const Sprint = mongoose.model('Sprint', sprintSchema);

export default Sprint;
