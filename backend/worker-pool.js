// backend/worker-pool.js
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class WorkerPool {
  constructor(poolSize = os.cpus().length) {
    this.poolSize = poolSize;
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
    
    // Initialize workers
    this.initializeWorkers();
  }
  
  initializeWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    const worker = new Worker(path.join(__dirname, 'worker.js'));
    worker.setMaxListeners(20);

    // 1. Handle Successful Message
    worker.on('message', (result) => {
      this.activeWorkers--;
      
      // Retrieve the task this worker was working on
      const currentTask = worker.currentTask;
      worker.currentTask = null; // Clear the task assignment

      // Assign next task or return to pool
      if (this.taskQueue.length > 0) {
        const nextTask = this.taskQueue.shift();
        this.executeTask(worker, nextTask);
      } else {
        this.workers.push(worker);
      }
      
      // Invoke the callback stored in the main thread
      if (currentTask && currentTask.callback) {
        currentTask.callback(result);
      }
    });
    
    // 2. Handle Worker Error (The Crash Fix)
    worker.on('error', (error) => {
      console.error(`Worker error: ${error.message}`);
      this.activeWorkers--;
      
      // Retrieve the failed task
      const failedTask = worker.currentTask;

      // Replace the dead worker with a new one
      this.addWorker();
      
      // Fail the specific task that caused the error
      if (failedTask && failedTask.callback) {
        failedTask.callback({ success: false, error: error.message });
      }
    });
    
    // 3. Handle Unexpected Exit
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
        // Note: 'error' event usually fires before 'exit' if it was an error,
        // so we generally handle cleanup there.
      }
    });
    
    this.workers.push(worker);
  }
  
  executeTask(worker, task) {
    this.activeWorkers++;
    // STORE THE TASK ON THE WORKER OBJECT SO WE CAN RECOVER IT LATER
    worker.currentTask = task; 
    worker.postMessage(task.data);
  }
  
  runTask(data) {
    return new Promise((resolve, reject) => {
      const task = { 
        data, 
        callback: (result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(result.error);
          }
        }
      };
      
      if (this.workers.length > 0) {
        const worker = this.workers.shift();
        this.executeTask(worker, task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }
  
  distributeCSVGeneration(fields, totalRows, jobId) {
    const maxChunkSize = 10000; // Rows per chunk
    const totalChunks = Math.ceil(totalRows / maxChunkSize);
    const tasks = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkSize = Math.min(maxChunkSize, totalRows - (i * maxChunkSize));
      tasks.push({
        data: {
          fields,
          totalRows,
          chunkSize,
          jobId,
          chunkIndex: i,
          totalChunks
        }
      });
    }
    
    return tasks;
  }
  
  async executeParallel(tasks) {
    const promises = tasks.map(task => 
      this.runTask(task.data)
    );
    
    return Promise.allSettled(promises);
  }
  
  destroy() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.taskQueue = [];
  }
}

module.exports = WorkerPool;