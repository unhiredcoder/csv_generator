// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FieldManager from './components/FieldManager';
import GenerationPanel from './components/GenerationPanel';
import HistoryPanel from './components/HistoryPanel';
import './App.css';

/* ================================
   CONFIG
================================ */
const API_BASE = "https://csv-generator-dn6v.onrender.com";
const WS_URL = "wss://csv-generator-dn6v.onrender.com";

axios.defaults.baseURL = API_BASE;

function App() {
  const [fields, setFields] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  /* ================================
     INITIAL LOAD
  ================================= */
  useEffect(() => {
    const defaultFields = [
      { id: '1', name: 'id', type: 'id', order: 0 },
      { id: '2', name: 'first_name', type: 'first_name', order: 1 },
      { id: '3', name: 'last_name', type: 'last_name', order: 2 },
      { id: '4', name: 'username', type: 'username', order: 3 },
      { id: '5', name: 'email', type: 'email', order: 4 },
      { id: '6', name: 'phone_number', type: 'phone', order: 5 }
    ];

    setFields(defaultFields);

    loadFieldTypes();
    checkBackendHealth();
    initWebSocket();

  }, []);

  /* ================================
     WEBSOCKET
  ================================= */
  const initWebSocket = () => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      console.log("🔄 Connecting WebSocket...");
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("✅ WebSocket Connected");
        setIsWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleProgressUpdate(data);
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      };

      ws.onerror = () => {
        console.error("WebSocket error");
        setIsWsConnected(false);
      };

      ws.onclose = () => {
        console.log("❌ WebSocket Disconnected");
        setIsWsConnected(false);

        reconnectTimeout = setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  };

  /* ================================
     API CALLS
  ================================= */
  const loadFieldTypes = async () => {
    try {
      const response = await axios.get('/api/field-types');
      if (response.data.success) {
        setAvailableTypes(response.data.fieldTypes);
      }
    } catch (error) {
      console.error("Field types load failed:", error);
    }
  };

  const checkBackendHealth = async () => {
    try {
      const response = await axios.get('/api/health');
      setBackendHealth(response.data);
    } catch (error) {
      setBackendHealth({ status: "Disconnected" });
    }
  };

  /* ================================
     PROGRESS HANDLER
  ================================= */
  const handleProgressUpdate = (data) => {
    setGenerationStatus(prev => {
      if (!prev || prev.jobId !== data.jobId) {
        return {
          jobId: data.jobId,
          status: data.status || "processing",
          progress: data.progress || 0,
          message: data.message || "",
          fileSize: data.fileSize || "",
          processingTime: data.processingTime || "",
          downloadUrl: data.downloadUrl || ""
        };
      }

      return {
        ...prev,
        ...data,
        progress: data.progress ?? prev.progress
      };
    });
  };

  /* ================================
     FIELD HANDLERS
  ================================= */
  const addField = () => {
    const newField = {
      id: Date.now().toString(),
      name: `field_${fields.length + 1}`,
      type: 'id',
      order: fields.length
    };
    setFields([...fields, newField]);
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id, updates) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const reorderFields = (newOrder) => {
    setFields(newOrder);
  };

  /* ================================
     GENERATE CSV
  ================================= */
  const generateCSV = async (rowCount) => {
    try {
      setGenerationStatus(null);

      const formattedFields = fields.map((f, index) => ({
        name: f.name,
        type: f.type,
        order: index
      }));

      const response = await axios.post('/api/generate-csv', {
        fields: formattedFields,
        rowCount: parseInt(rowCount)
      });

      if (response.data.success) {
        setGenerationStatus({
          jobId: response.data.jobId,
          status: "starting",
          progress: 0,
          message: "Starting CSV generation..."
        });
      }

    } catch (error) {
      alert(error.response?.data?.error || error.message);
    }
  };

  const downloadCSV = (jobId) => {
    window.open(`${API_BASE}/api/download/${jobId}`, "_blank");
  };

  /* ================================
     UI
  ================================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">

        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800">
            📊 CSV Data Generator
          </h1>

          <div className="flex justify-center gap-4 mt-4">

            <div className={`px-4 py-2 rounded-lg ${backendHealth?.status === 'OK'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
              }`}>
              Backend: {backendHealth?.status || "Disconnected"}
            </div>

            <div className={`px-4 py-2 rounded-lg ${isWsConnected
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
              }`}>
              Live Updates: {isWsConnected ? "Connected" : "Connecting..."}
            </div>

          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2 space-y-8">
            <FieldManager
              fields={fields}
              availableTypes={availableTypes}
              onAddField={addField}
              onRemoveField={removeField}
              onUpdateField={updateField}
              onReorderFields={reorderFields}
            />

            <GenerationPanel
              onGenerate={generateCSV}
              generationStatus={generationStatus}
              onDownload={downloadCSV}
              maxRows={100000}
              isWsConnected={isWsConnected}
            />
          </div>

          <div>
            <HistoryPanel />
          </div>
        </div>

        <footer className="mt-12 text-center text-gray-500 text-sm">
          CSV Generator • Worker Threads • Real-time WebSocket Progress
        </footer>

      </div>
    </div>
  );
}

export default App;
