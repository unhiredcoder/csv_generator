# 📊 CSV Data Generator (Worker Threads + WebSockets)

A high-performance CSV generation system built with **Node.js Worker Threads**, **WebSockets**, and **MongoDB**.  
Designed to generate large CSV files efficiently with real-time progress tracking.

---

## 🚀 Live Demo

Live: [https://csv-generator-eta.vercel.app  ](https://csv-generator-eta.vercel.app/)

---

## 🧠 Architecture Overview

This project is designed for scalability and performance:

- 🧵 **Worker Threads** for parallel CSV chunk processing
- ⚡ **WebSockets** for real-time progress updates
- 🗄 **MongoDB** for job persistence and history
- 🌍 **Render Deployment**
- 📦 Efficient chunk merging for large file generation

---

## 🔥 Features

- Generate up to 500,000+ rows
- Parallel processing using worker pool
- Real-time progress updates via WebSocket
- Download generated CSV
- Job history tracking
- Health check endpoint
- Automatic temp file cleanup

---

## 🛠 Tech Stack

### Backend
- Node.js
- Express.js
- Worker Threads
- ws (WebSocket)
- MongoDB (Mongoose)

### Frontend
- React
- Axios
- Tailwind CSS

---

## 📂 Project Structure

```
backend/
 ├── server.js
 ├── worker-pool.js
 ├── CsvGeneration.js
 ├── workers/
 ├── temp/
 └── generated/

frontend/
 ├── src/
 │   ├── components/
 │   └── App.jsx
```

---

## ⚙️ Environment Variables

Create a `.env` file in backend:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
WORKER_POOL_SIZE=4
MAX_ROWS_PER_GENERATION=500000
FRONTEND_URL=https://your-frontend-url
```

---

## ▶️ Running Locally

### 1️⃣ Install Dependencies

Backend:
```
cd backend
npm install
```

Frontend:
```
cd frontend
npm install
```

---

### 2️⃣ Start Backend

```
npm start
```

---

### 3️⃣ Start Frontend

```
npm run dev
```

---

## 🔌 WebSocket Setup

The WebSocket server is attached to the HTTP server:

```js
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
```

Frontend connects using:

```js
const ws = new WebSocket("wss://your-backend-url");
```

---

## 📡 API Endpoints

### Generate CSV
```
POST /api/generate-csv
```

### Download CSV
```
GET /api/download/:jobId
```

### Get History
```
GET /api/history
```

### Health Check
```
GET /api/health
```

---

## 📈 Performance Design

Instead of generating large CSV files on a single thread:

1. Work is split into chunks.
2. Distributed to worker threads.
3. Processed in parallel.
4. Merged into final file.
5. Progress broadcast via WebSocket.

This prevents blocking the event loop and ensures scalability.

---

## 🧪 Example Use Case

Generate:
- 100,000 rows
- 6 dynamic fields
- Real-time progress updates
- Final downloadable CSV

---

## 🧵 Why Worker Threads?

Node.js is single-threaded by default.  
Worker Threads allow CPU-heavy operations like large CSV generation to run in parallel without blocking the main thread.

---

## 📌 Deployment Notes (Render)

- WebSocket must attach to the same HTTP server.
- Use `wss://` in production.
- Do NOT open separate ports like 8080.

---

## 📄 License

MIT License

---

## 👨‍💻 Author

Aditya Maurya  
Full-Stack MERN Developer  
