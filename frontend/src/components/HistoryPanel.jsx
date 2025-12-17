// frontend/src/components/HistoryPanel.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaDownload, FaClock, FaDatabase, FaFileCsv } from 'react-icons/fa';

function HistoryPanel() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    // Refresh every 30 seconds
    const interval = setInterval(loadHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      const response = await axios.get('/api/history');
      if (response.data.success) {
        setHistory(response.data.data);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadFile = (jobId) => {
    window.open(`/api/download/${jobId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Generation History</h2>
        <button
          onClick={loadHistory}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Refresh
        </button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FaFileCsv className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>No generation history yet</p>
          <p className="text-sm mt-1">Generate your first CSV file!</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {history.map((item) => (
            <div
              key={item.jobId}
              className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-gray-800 truncate">
                    {item.filename}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.workerThreadsUsed} workers
                    </span>
                  </div>
                </div>
                
                {item.status === 'completed' && (
                  <button
                    onClick={() => downloadFile(item.jobId)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    title="Download"
                  >
                    <FaDownload />
                  </button>
                )}
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FaDatabase className="mr-1 text-gray-400" />
                    <span>{item.rowCount.toLocaleString()} rows</span>
                  </div>
                  {item.fileSize && (
                    <span>{item.fileSize}</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FaClock className="mr-1 text-gray-400" />
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  {item.processingTime && (
                    <span>{formatTime(item.processingTime)}</span>
                  )}
                </div>
                
                {item.fields && (
                  <div className="text-xs text-gray-500 truncate">
                    Fields: {item.fields.slice(0, 3).map(f => f.name).join(', ')}
                    {item.fields.length > 3 && '...'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="inline-flex items-center text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <FaDatabase className="w-4 h-4 mr-2 text-blue-500" />
            MongoDB stores all generation metadata
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;