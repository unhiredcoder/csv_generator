const { spawn } = require('child_process');

// Backend: use Node 16 then start
const backend = spawn('bash', ['-c', '. ~/.nvm/nvm.sh && nvm use 16 && npm start'], {
  cwd: 'backend',
  stdio: 'inherit'
});

// Frontend: use Node 17 then run dev
const frontend = spawn('bash', ['-c', '. ~/.nvm/nvm.sh && nvm use 17 && npm run dev -- --host --port 5173'], {
  cwd: 'frontend',
  stdio: 'inherit'
});

// Handle exits
backend.on('close', (code) => {
  console.log(`Backend exited with code ${code}`);
});

frontend.on('close', (code) => {
  console.log(`Frontend exited with code ${code}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Stopping both processes...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
});
