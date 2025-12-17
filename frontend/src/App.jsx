// frontend/src/App.jsx - SIMPLIFIED
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import FieldManager from './components/FieldManager';
import GenerationPanel from './components/GenerationPanel';
import HistoryPanel from './components/HistoryPanel';
import './App.css';

axios.defaults.baseURL = 'http://10.10.15.140:5000';

function App() {
  const [fields, setFields] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  useEffect(() => {
    // Load default fields - 4 simple fields
    const defaultFields = [
      { id: '1', name: 'id', type: 'id', order: 0 },
      { id: '5', name: 'first_name', type: 'first_name', order: 4 },
      { id: '6', name: 'last_name', type: 'last_name', order: 5  },
      { id: '2', name: 'username', type: 'username', order: 1 },
      { id: '3', name: 'email', type: 'email', order: 2 },
      { id: '4', name: 'phone_number', type: 'phone', order: 3 }
    ];
    setFields(defaultFields);

    // Load field types
    loadFieldTypes();
    
    // Check backend health
    checkBackendHealth();
    
    // Setup WebSocket connection
    setupWebSocket();

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  const loadFieldTypes = async () => {
    try {
      const response = await axios.get('/api/field-types');
      if (response.data.success) {
        setAvailableTypes(response.data.fieldTypes);
      }
    } catch (error) {
      console.error('Failed to load field types:', error);
      // Set default types if API fails
      setAvailableTypes([
        { value: 'id', label: 'ID', description: 'Unique identifier' },
        { value: 'username', label: 'Username', description: 'Sequential usernames' },
        { value: 'email', label: 'Email', description: 'Sequential emails' },
        { value: 'phone', label: 'Phone', description: 'Phone numbers' }
      ]);
    }
  };

  const checkBackendHealth = async () => {
    try {
      const response = await axios.get('/api/health');
      setBackendHealth(response.data);
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendHealth({ 
        status: 'disconnected',
        error: error.message 
      });
    }
  };

  const setupWebSocket = () => {
    console.log('Setting up WebSocket connection...');
    const ws = new WebSocket('ws://10.10.15.140:8080');
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setWsConnection(ws);
      setIsWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 Progress update:', {
          jobId: data.jobId,
          status: data.status,
          progress: data.progress,
          message: data.message
        });
        
        handleProgressUpdate(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsWsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnection(null);
      setIsWsConnected(false);
      // Attempt reconnect after 5 seconds
      setTimeout(setupWebSocket, 5000);
    };
  };

  const handleProgressUpdate = (data) => {
    setGenerationStatus(prev => {
      // If no previous status or different jobId, create new
      if (!prev || prev.jobId !== data.jobId) {
        return {
          jobId: data.jobId,
          status: data.status || 'processing',
          progress: data.progress || 0,
          message: data.message || '',
          fileSize: data.fileSize || '',
          processingTime: data.processingTime || '',
          downloadUrl: data.downloadUrl || '',
          totalChunks: data.totalChunks || 0
        };
      }
      
      // Update existing status
      return {
        ...prev,
        ...data,
        progress: data.progress !== undefined ? data.progress : prev.progress
      };
    });
  };

  const addField = () => {
    const newField = {
      id: Date.now().toString(),
      name: `field_${fields.length + 1}`,
      type: 'id',
      order: fields.length
    };
    setFields([...fields, newField]);
  };

  const removeField = (fieldId) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const updateField = (fieldId, updates) => {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  };

  const reorderFields = (newOrder) => {
    setFields(newOrder);
  };

  const generateCSV = async (rowCount) => {
    try {
      // Clear any previous status
      setGenerationStatus(null);
      
      const formattedFields = fields.map((f, index) => ({
        name: f.name,
        type: f.type,
        order: index
      }));

      console.log('Starting CSV generation:', { 
        fields: formattedFields, 
        rowCount 
      });

      const response = await axios.post('/api/generate-csv', {
        fields: formattedFields,
        rowCount: parseInt(rowCount)
      });

      if (response.data.success) {
        setGenerationStatus({
          jobId: response.data.jobId,
          status: 'starting',
          progress: 0,
          message: response.data.message || 'Starting CSV generation...'
        });
        
        console.log('Generation started with jobId:', response.data.jobId);
      }
    } catch (error) {
      console.error('Generation error:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Error: ${errorMsg}`);
      
      setGenerationStatus({
        status: 'failed',
        message: `Failed: ${errorMsg}`
      });
    }
  };

  const downloadCSV = (jobId) => {
    window.open(`${axios.defaults.baseURL}/api/download/${jobId}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                📊 CSV Data Generator
              </h1>
              <p className="text-gray-600">
                Generate CSV files with sequential unique data
              </p>
            </div>
            
            <div className="mt-4 md:mt-0 space-y-2">
              {backendHealth && (
                <div className={`px-4 py-2 rounded-lg ${backendHealth.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${backendHealth.status === 'OK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Backend: {backendHealth.status || 'Disconnected'}</span>
                  </div>
                </div>
              )}
              
              <div className={`px-4 py-2 rounded-lg ${isWsConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${isWsConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span>Live Updates: {isWsConnected ? 'Connected' : 'Connecting...'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Worker Threads
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Drag & Drop
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              Sequential Data
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              Real-time Progress
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Field Manager */}
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

          {/* Right Column - History & Stats */}
          <div className="lg:col-span-1">
            <HistoryPanel />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>
            CSV Generator • Simple sequential data • No external dependencies
          </p>
          <p className="mt-2">
            Backend: http://10.10.15.140:5000 • WebSocket: ws://10.10.15.140:8080
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;