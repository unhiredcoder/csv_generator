// backend/server.js - FULL VERSION (Render + WebSocket Fixed)

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
require('dotenv').config();

const CsvGeneration = require('./CsvGeneration');
const WorkerPool = require('./worker-pool');

const app = express();
const PORT = process.env.PORT || 5000;

/* ================================
   CREATE HTTP SERVER (IMPORTANT)
================================ */
const server = http.createServer(app);

/* ================================
   WEBSOCKET ATTACHED TO SERVER
================================ */
const wss = new WebSocket.Server({ server });
const clients = new Map();

/* ================================
   CREATE DIRECTORIES
================================ */
['temp', 'generated'].forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/* ================================
   MIDDLEWARE
================================ */
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use('/downloads', express.static(path.join(__dirname, 'generated')));

/* ================================
   MONGODB
================================ */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

/* ================================
   WORKER POOL
================================ */
const workerPool = new WorkerPool(parseInt(process.env.WORKER_POOL_SIZE) || 4);

/* ================================
   WEBSOCKET CONNECTION
================================ */
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  console.log(`🔌 WebSocket connected: ${clientId}`);

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`❌ WebSocket disconnected: ${clientId}`);
  });
});

/* ================================
   BROADCAST FUNCTION
================================ */
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

/* ================================
   FIELD TYPES
================================ */
app.get('/api/field-types', (req, res) => {
  const fieldTypes = [
    { value: 'id', label: 'ID', description: 'Unique identifier' },
    { value: 'username', label: 'Username' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'status', label: 'Status' },
    { value: 'score', label: 'Score' },
    { value: 'created_date', label: 'Created Date' },
    { value: 'department', label: 'Department' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' }
  ];

  res.json({ success: true, fieldTypes });
});

/* ================================
   GENERATE CSV
================================ */
app.post('/api/generate-csv', async (req, res) => {
  const { fields, rowCount = 1000 } = req.body;
  const jobId = uuidv4();

  try {
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field required'
      });
    }

    const rows = parseInt(rowCount);
    if (isNaN(rows) || rows < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid row count'
      });
    }

    const generationRecord = new CsvGeneration({
      jobId,
      filename: `generated_${Date.now()}.csv`,
      fields,
      rowCount: rows,
      status: 'processing',
      createdAt: new Date()
    });

    await generationRecord.save();

    res.json({
      success: true,
      jobId,
      message: 'CSV generation started'
    });

    processCSVGeneration(jobId, fields, rows, generationRecord);

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ================================
   PROCESS CSV
================================ */
async function processCSVGeneration(jobId, fields, rowCount, record) {
  const startTime = Date.now();

  try {
    broadcastProgress(jobId, {
      status: 'starting',
      progress: 0,
      message: 'Starting CSV generation...'
    });

    const tasks = workerPool.distributeCSVGeneration(fields, rowCount, jobId);
    const totalChunks = tasks.length;

    const results = await workerPool.executeParallel(tasks);

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) throw new Error('Worker task failed');

    broadcastProgress(jobId, {
      status: 'merging',
      progress: 80,
      message: 'Merging chunks...'
    });

    const finalFilePath = path.join(__dirname, 'generated', `${jobId}.csv`);
    const writeStream = fs.createWriteStream(finalFilePath);

    // Write header
    const header = fields.map(f => `"${f.name}"`).join(',') + '\n';
    writeStream.write(header);

    for (let i = 0; i < totalChunks; i++) {
      const partPath = path.join(__dirname, 'temp', `${jobId}_part_${i}.csv`);

      if (fs.existsSync(partPath)) {
        const content = fs.readFileSync(partPath, 'utf8');
        const lines = content.split('\n').slice(1).filter(Boolean);
        writeStream.write(lines.join('\n') + '\n');

        fs.unlinkSync(partPath);
      }
    }

    writeStream.end();
    await new Promise(resolve => writeStream.on('finish', resolve));

    const processingTime = Date.now() - startTime;

    record.status = 'completed';
    record.completedAt = new Date();
    record.processingTime = processingTime;
    record.downloadPath = `/api/download/${jobId}`;

    await record.save();

    broadcastProgress(jobId, {
      status: 'completed',
      progress: 100,
      message: 'CSV generation completed!',
      downloadUrl: `/api/download/${jobId}`
    });

  } catch (error) {
    record.status = 'failed';
    await record.save();

    broadcastProgress(jobId, {
      status: 'failed',
      progress: 0,
      message: error.message
    });
  }
}

/* ================================
   DOWNLOAD
================================ */
app.get('/api/download/:jobId', async (req, res) => {
  const generation = await CsvGeneration.findOne({ jobId: req.params.jobId });

  if (!generation) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const filePath = path.join(__dirname, 'generated', `${req.params.jobId}.csv`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File missing' });
  }

  res.download(filePath, generation.filename);
});

/* ================================
   HISTORY
================================ */
app.get('/api/history', async (req, res) => {
  const history = await CsvGeneration.find().sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: history });
});

/* ================================
   HEALTH
================================ */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

/* ================================
   CLEANUP
================================ */
process.on('SIGINT', () => {
  workerPool.destroy();
  process.exit(0);
});

/* ================================
   START SERVER
================================ */
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 CSV Generator Backend Running
  🌍 Port: ${PORT}
  🧵 Worker Pool Size: ${workerPool.poolSize}
  `);
});

