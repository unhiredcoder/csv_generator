// backend/worker.js - SIMPLIFIED WITHOUT FAKER
const { parentPort, workerData } = require('worker_threads');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

// Simple field generators - no external dependencies
const fieldGenerators = {
  'id': (index) => `${index}`,
  'username': (index) => `user${index}`,
  'email': (index) => `user${index}@example.com`,
  'phone': (index) => `+91837${String(1000 + (index % 9000)).padStart(4, '0')}`,
  'status': (index) => index % 2 === 0 ? 'Active' : 'Inactive',
  'score': (index) => Math.floor(Math.random() * 1000),
  'created_date': (index) => {
    const date = new Date();
    date.setDate(date.getDate() - (index % 365));
    return date.toISOString().split('T')[0];
  },
  'department': (index) => {
    const depts = ['Engineering', 'Marketing', 'Sales', 'Support', 'HR', 'Finance'];
    return depts[index % depts.length];
  },
  'first_name': (index) => `fname${index}`,
  'last_name': (index) => `lname${index}`
}


function generateCSVChunk(fields, startRow, chunkSize) {
  const data = [];
  
  for (let i = 0; i < chunkSize; i++) {
    const row = {};
    const rowIndex = startRow + i;
    
    fields.forEach(field => {
      const generator = fieldGenerators[field.type];
      if (generator) {
        row[field.name] = generator(rowIndex);
      } else {
        // Default text generator
        row[field.name] = `value_${rowIndex}`;
      }
    });
    
    data.push(row);
  }
  
  return data;
}

async function processCSVGeneration(data) {
  const { fields, totalRows, chunkSize, jobId, chunkIndex, totalChunks } = data;
  const startRow = chunkIndex * chunkSize;
  const currentChunkSize = Math.min(chunkSize, totalRows - startRow);
  
  console.log(`Worker: Processing chunk ${chunkIndex} (rows ${startRow + 1} to ${startRow + currentChunkSize})`);
  
  try {
    // Generate CSV chunk
    const records = generateCSVChunk(fields, startRow, currentChunkSize);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create CSV writer
    const csvWriter = createCsvWriter({
      path: path.join(tempDir, `${jobId}_part_${chunkIndex}.csv`),
      header: fields.map(f => ({ 
        id: f.name, 
        title: f.name 
      })),
      alwaysQuote: false // No need to quote since we control the data
    });
    
    // Write chunk to file
    await csvWriter.writeRecords(records);
    
    console.log(`Worker: Completed chunk ${chunkIndex} (${currentChunkSize} rows)`);
    
    return {
      success: true,
      chunkIndex,
      rowsGenerated: currentChunkSize,
      filePath: path.join(tempDir, `${jobId}_part_${chunkIndex}.csv`)
    };
  } catch (error) {
    console.error(`Worker error in chunk ${chunkIndex}:`, error.message);
    return {
      success: false,
      chunkIndex,
      error: error.message
    };
  }
}

// Listen for messages from main thread
parentPort.on('message', async (data) => {
  console.log(`Worker received task for chunk ${data.chunkIndex}`);
  try {
    const result = await processCSVGeneration(data);
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  }
});

// Handle immediate data if passed at worker creation
if (workerData) {
  console.log(`Worker started with initial data for chunk ${workerData.chunkIndex}`);
  processCSVGeneration(workerData)
    .then(result => {
      parentPort.postMessage(result);
    })
    .catch(error => {
      parentPort.postMessage({
        success: false,
        error: error.message
      });
    });
}