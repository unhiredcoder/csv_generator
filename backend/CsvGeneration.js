// backend/models/CsvGeneration.js - Make sure this is correct
const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true
  }
});

const csvGenerationSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true
  },
  filename: {
    type: String,
    required: true
  },
  fields: [fieldSchema],  
  rowCount: {
    type: Number,
    required: true
  },
  fileSize: {
    type: String
  },
  processingTime: {
    type: Number  
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  workerThreadsUsed: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  downloadPath: {
    type: String
  }
});

module.exports = mongoose.model('CsvGeneration', csvGenerationSchema);