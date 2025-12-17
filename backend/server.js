// backend/server.js - UPDATED VERSION
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws'); // Make sure this is imported
require('dotenv').config();

const CsvGeneration = require('./CsvGeneration'); // Fixed path
const WorkerPool = require('./worker-pool');

const app = express();
const PORT = process.env.PORT || 5000;

// Create directories if they don't exist
[path.join(__dirname, 'temp'), path.join(__dirname, 'generated')].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://10.10.15.140:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/downloads', express.static(path.join(__dirname, 'generated')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/csvgenerator')
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Initialize worker pool
const workerPool = new WorkerPool(parseInt(process.env.WORKER_POOL_SIZE) || 4);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  console.log(`WebSocket client connected: ${clientId}`);
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  });
});

function broadcastProgress(jobId, progress) {
  const message = JSON.stringify({
    type: 'progress',
    jobId,
    ...progress
  });
  
  clients.forEach((client, clientId) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(clientId);
    }
  });
}

// In server.js, update the /api/field-types endpoint and default fields:
const defaultFields = [
  { name: 'id', type: 'id', order: 0 },
  { name: 'username', type: 'username', order: 1 },
  { name: 'email', type: 'email', order: 2 },
  { name: 'phone', type: 'phone', order: 3 },
  { name: 'first_name', type: 'first_name', order: 4 },
  { name: 'last_name', type: 'last_name', order: 5 },


];

// Get available field types
app.get('/api/field-types', (req, res) => {
  const fieldTypes = [
    { value: 'id', label: 'ID', description: 'Unique identifier' },
    { value: 'username', label: 'Username', description: 'Sequential usernames (user1, user2...)' },
    { value: 'email', label: 'Email', description: 'Sequential emails (user1@example.com...)' },
    { value: 'phone', label: 'Phone', description: 'Sequential phone numbers' },
    { value: 'status', label: 'Status', description: 'Active/Inactive status' },
    { value: 'score', label: 'Score', description: 'Random score (0-999)' },
    { value: 'created_date', label: 'Created Date', description: 'Random past date' },
    { value: 'department', label: 'Department', description: 'Department name' },
    { value: 'first_name', label: 'first_name', description: 'First name of the person' },
    { value: 'last_name', label: 'last_name', description: 'Last name of the person' },
  ];
  
  res.json({ success: true, fieldTypes });
});




// Generate CSV with worker threads
app.post('/api/generate-csv', async (req, res) => {
  const { fields, rowCount = 1000 } = req.body;
  const jobId = uuidv4();
  
  try {
    console.log('Generation request received:', { jobId, rowCount, fieldsCount: fields?.length });
    
    // Validate fields
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be specified'
      });
    }
    
    // Format fields
    const formattedFields = fields.map((field, index) => ({
      name: field.name?.trim() || `field_${index}`,
      type: field.type || 'text',
      order: field.order !== undefined ? field.order : index
    }));
    
    console.log('Formatted fields:', formattedFields);
    
    // Validate row count
    const maxRows = parseInt(process.env.MAX_ROWS_PER_GENERATION) || 500000;
    const rows = parseInt(rowCount);
    
    if (isNaN(rows) || rows < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid row count'
      });
    }
    
    if (rows > maxRows) {
      return res.status(400).json({
        success: false,
        error: `Cannot generate more than ${maxRows.toLocaleString()} rows`
      });
    }
    
    // Save generation record
    const generationRecord = new CsvGeneration({
      jobId,
      filename: `generated_${Date.now()}.csv`,
      fields: formattedFields,
      rowCount: rows,
      status: 'processing',
      createdAt: new Date()
    });
    
    await generationRecord.save();
    console.log(`Generation record saved: ${generationRecord._id}`);
    
    // Respond immediately
    res.json({
      success: true,
      jobId,
      message: 'CSV generation started',
      estimatedTime: `${Math.ceil(rows / 10000)} seconds`
    });
    
    // Start async processing
    processCSVGeneration(jobId, formattedFields, rows, generationRecord);
    
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

async function processCSVGeneration(jobId, fields, rowCount, generationRecord) {
  const startTime = Date.now();
  
  try {
    broadcastProgress(jobId, { 
      status: 'starting', 
      progress: 0, 
      message: 'Starting CSV generation...' 
    });
    
    // Distribute work among workers
    const tasks = workerPool.distributeCSVGeneration(fields, rowCount, jobId);
    const totalChunks = tasks.length;
    
    broadcastProgress(jobId, { 
      status: 'distributing', 
      totalChunks, 
      progress: 10,
      message: `Distributing ${totalChunks} chunks to worker threads...` 
    });
    
    // Execute tasks in parallel
    const results = await workerPool.executeParallel(tasks);
    
    // Check for failed tasks
    const failedTasks = results.filter(r => r.status === 'rejected' || (r.value && !r.value.success));
    if (failedTasks.length > 0) {
      throw new Error(`${failedTasks.length} worker tasks failed`);
    }
    
    broadcastProgress(jobId, { 
      status: 'merging', 
      progress: 80,
      message: 'Merging chunks into single CSV file...' 
    });
    
    // Merge all chunks into single CSV
    const finalFilePath = path.join(__dirname, 'generated', `${jobId}.csv`);
    const writeStream = fs.createWriteStream(finalFilePath);
    
    // Write header
    const header = fields.map(f => `"${f.name.replace(/"/g, '""')}"`).join(',') + '\n';
    writeStream.write(header);
    
    // Merge all parts
    let totalRowsMerged = 0;
    for (let i = 0; i < totalChunks; i++) {
      const partPath = path.join(__dirname, 'temp', `${jobId}_part_${i}.csv`);
      if (fs.existsSync(partPath)) {
        const content = fs.readFileSync(partPath, 'utf8');
        const lines = content.split('\n');
        // Skip header if present in part file
        const dataLines = lines.slice(1).filter(line => line.trim());
        if (dataLines.length > 0) {
          writeStream.write(dataLines.join('\n') + (i < totalChunks - 1 ? '\n' : ''));
          totalRowsMerged += dataLines.length;
        }
        
        // Clean up part file
        fs.unlinkSync(partPath);
        
        // Update progress
        const progress = 80 + Math.floor((i + 1) / totalChunks * 20);
        broadcastProgress(jobId, { 
          status: 'merging', 
          chunk: i + 1, 
          totalChunks, 
          progress,
          message: `Merged ${i + 1}/${totalChunks} chunks (${totalRowsMerged.toLocaleString()} rows)...`
        });
      }
    }
    
    writeStream.end();
    
    // Wait for file to be written
    await new Promise(resolve => writeStream.on('finish', resolve));
    
    const processingTime = Date.now() - startTime;
    const stats = fs.statSync(finalFilePath);
    const fileSize = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
    
    // Update generation record
    generationRecord.status = 'completed';
    generationRecord.processingTime = processingTime;
    generationRecord.fileSize = fileSize;
    generationRecord.workerThreadsUsed = workerPool.poolSize;
    generationRecord.downloadPath = `/downloads/${jobId}.csv`;
    generationRecord.completedAt = new Date();
    
    await generationRecord.save();
    
    broadcastProgress(jobId, { 
      status: 'completed', 
      progress: 100,
      message: 'CSV generation completed!',
      downloadUrl: `/api/download/${jobId}`,
      processingTime,
      fileSize,
      filename: generationRecord.filename
    });
    
    console.log(`Generation completed: ${jobId} (${processingTime}ms)`);
    
  } catch (error) {
    console.error('Processing error:', error);
    
    // Update generation record
    generationRecord.status = 'failed';
    generationRecord.completedAt = new Date();
    await generationRecord.save();
    
    broadcastProgress(jobId, { 
      status: 'failed', 
      progress: 0,
      message: `Generation failed: ${error.message}`,
      error: error.message
    });
  }
}

// Get generation status
app.get('/api/generation/:jobId', async (req, res) => {
  try {
    const generation = await CsvGeneration.findOne({ jobId: req.params.jobId });
    
    if (!generation) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }
    
    res.json({
      success: true,
      generation
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download CSV
app.get('/api/download/:jobId', async (req, res) => {
  try {
    const generation = await CsvGeneration.findOne({ jobId: req.params.jobId });
    
    if (!generation || generation.status !== 'completed') {
      return res.status(404).json({
        success: false,
        error: 'File not available or generation not completed'
      });
    }
    
    const filePath = path.join(__dirname, 'generated', `${req.params.jobId}.csv`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }
    
    res.download(filePath, generation.filename);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get generation history
app.get('/api/history', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const [history, total] = await Promise.all([
      CsvGeneration.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CsvGeneration.countDocuments()
    ]);
    
    res.json({
      success: true,
      data: history,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    workerPool: {
      size: workerPool.poolSize,
      active: workerPool.activeWorkers || 0,
      idle: workerPool.workers?.length || 0,
      queued: workerPool.taskQueue?.length || 0
    },
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Cleanup temp files on exit
process.on('SIGINT', () => {
  console.log('Cleaning up...');
  
  // Clean temp directory
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      try {
        fs.unlinkSync(path.join(tempDir, file));
      } catch (err) {
        console.error(`Error cleaning up file ${file}:`, err);
      }
    });
  }
  
  workerPool.destroy();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 CSV Generator Backend
  🔗 URL: http://10.10.15.140:${PORT}
  🧵 Worker Pool Size: ${workerPool.poolSize}
  `);
});