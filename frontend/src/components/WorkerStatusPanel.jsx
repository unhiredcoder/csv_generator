// frontend/src/components/WorkerStatusPanel.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaServer, FaCogs, FaPlay, FaPause, FaSync, FaMicrochip, FaMemory, FaClock, FaTasks } from 'react-icons/fa';

function WorkerStatusPanel({ onModeChange, currentMode }) {
  const [workerStatus, setWorkerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchWorkerStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchWorkerStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchWorkerStatus = async () => {
    try {
      const response = await axios.get('/api/worker-status');
      if (response.data.success) {
        setWorkerStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching worker status:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = async () => {
    const newMode = currentMode === 'workers' ? 'main' : 'workers';
    try {
      const response = await axios.post('/api/set-mode', { mode: newMode });
      if (response.data.success) {
        onModeChange(newMode);
      }
    } catch (error) {
      console.error('Error changing mode:', error);
    }
  };

  const getWorkerColor = (status) => {
    switch (status) {
      case 'working': return 'bg-green-500';
      case 'idle': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getWorkerIcon = (status) => {
    switch (status) {
      case 'working': return '⚡';
      case 'idle': return '💤';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FaServer className="w-6 h-6 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold text-gray-800">Worker Thread Monitor</h2>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <FaSync className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={fetchWorkerStatus}
            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            title="Refresh Now"
          >
            <FaSync className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FaMicrochip className="w-5 h-5 text-blue-600 mr-2" />
            <span className="font-medium text-gray-700">Generation Mode:</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full ${currentMode === 'main' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              Main Thread
            </span>
            
            <button
              onClick={toggleMode}
              className="relative inline-flex h-6 w-12 items-center rounded-full bg-gray-300 transition-colors duration-300 focus:outline-none"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                  currentMode === 'workers' ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
            
            <span className={`px-3 py-1 rounded-full ${currentMode === 'workers' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              Worker Threads
            </span>
          </div>
        </div>
        
        <div className="mt-3 text-sm text-gray-600">
          {currentMode === 'workers' ? (
            <p>✅ Using <span className="font-bold">4 worker threads</span> for parallel processing (faster, non-blocking)</p>
          ) : (
            <p>⚠️ Using <span className="font-bold">main thread only</span> (slower, blocks UI during generation)</p>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      {workerStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
            <div className="flex items-center">
              <FaCogs className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Total Workers</p>
                <p className="text-2xl font-bold text-gray-800">{workerStatus.poolSize}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
            <div className="flex items-center">
              <FaPlay className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Active Now</p>
                <p className="text-2xl font-bold text-gray-800">{workerStatus.active}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-4 rounded-xl">
            <div className="flex items-center">
              <FaPause className="w-5 h-5 text-cyan-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Idle Workers</p>
                <p className="text-2xl font-bold text-gray-800">{workerStatus.idle}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
            <div className="flex items-center">
              <FaTasks className="w-5 h-5 text-purple-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Queued Tasks</p>
                <p className="text-2xl font-bold text-gray-800">{workerStatus.queued}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Worker Thread Visualization */}
      <div className="mb-6">
        <h3 className="font-medium text-gray-700 mb-4">Live Worker Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {workerStatus?.workers?.map((worker, index) => (
            worker && (
              <div
                key={worker.id}
                className={`border rounded-xl p-4 transition-all duration-300 ${
                  worker.status === 'working' 
                    ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' 
                    : worker.status === 'idle'
                    ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50'
                    : 'border-red-300 bg-gradient-to-br from-red-50 to-pink-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${getWorkerColor(worker.status)}`}></div>
                    <span className="font-bold text-gray-800">Worker #{worker.id}</span>
                  </div>
                  <span className="text-2xl">{getWorkerIcon(worker.status)}</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium capitalize ${
                      worker.status === 'working' ? 'text-green-600' : 
                      worker.status === 'idle' ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {worker.status}
                    </span>
                  </div>
                  
                  {worker.currentJob && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Job:</span>
                      <span className="font-mono text-xs truncate max-w-[120px]" title={worker.currentJob}>
                        {worker.currentJob.substring(0, 8)}...
                      </span>
                    </div>
                  )}
                  
                  {worker.chunkIndex !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chunk:</span>
                      <span className="font-medium">#{worker.chunkIndex}</span>
                    </div>
                  )}
                  
                  {worker.progress > 0 && worker.status === 'working' && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Progress:</span>
                        <span className="font-bold">{Math.round(worker.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${worker.progress}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tasks:</span>
                    <span>{worker.tasksCompleted || 0} completed</span>
                  </div>
                  
                  {worker.lastActivity && (
                    <div className="text-xs text-gray-500">
                      Last activity: {new Date(worker.lastActivity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Performance Comparison */}
      <div className="pt-6 border-t border-gray-200">
        <h3 className="font-medium text-gray-700 mb-3">Performance Comparison</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <span className="text-green-600 font-bold">W</span>
              </div>
              <div>
                <p className="font-medium">Worker Threads Mode</p>
                <p className="text-sm text-gray-600">Parallel processing • Non-blocking • Faster</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
              RECOMMENDED
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold">M</span>
              </div>
              <div>
                <p className="font-medium">Main Thread Mode</p>
                <p className="text-sm text-gray-600">Single thread • Blocks UI • Slower</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              DEMONSTRATION
            </span>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-bold">Tip:</span> Try generating 50,000 rows with both modes to see the performance difference!
            Main thread will freeze the UI while worker threads keep it responsive.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WorkerStatusPanel;