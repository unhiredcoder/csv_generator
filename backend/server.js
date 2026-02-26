// backend/server.js - FIXED FOR RENDER WEBSOCKET

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
   CREATE REQUIRED DIRECTORIES
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
   MONGODB CONNECTION
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
   WEBSOCKET CONNECTION HANDLER
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
   HEALTH CHECK
================================ */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

/* ================================
   GENERATE CSV
================================ */
app.post('/api/generate-csv', async (req, res) => {
  const { fields, rowCount = 1000 } = req.body;
  const jobId = uuidv4();

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ success: false, error: 'Fields required' });
  }

  res.json({
    success: true,
    jobId,
    message: 'CSV generation started'
  });

  processCSVGeneration(jobId, fields, rowCount);
});

/* ================================
   CSV PROCESSING
================================ */
async function processCSVGeneration(jobId, fields, rowCount) {
  try {
    broadcastProgress(jobId, {
      status: 'starting',
      progress: 0,
      message: 'Starting CSV generation...'
    });

    const tasks = workerPool.distributeCSVGeneration(fields, rowCount, jobId);
    const results = await workerPool.executeParallel(tasks);

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) throw new Error('Worker task failed');

    broadcastProgress(jobId, {
      status: 'completed',
      progress: 100,
      message: 'CSV generation completed!'
    });

  } catch (error) {
    broadcastProgress(jobId, {
      status: 'failed',
      progress: 0,
      message: error.message
    });
  }
}

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
