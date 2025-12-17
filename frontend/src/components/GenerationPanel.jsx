// frontend/src/components/GenerationPanel.jsx - Fixed
import React, { useState } from 'react';
import { FaDownload, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

function GenerationPanel({ onGenerate, generationStatus, onDownload, maxRows }) {
  const [rowCount, setRowCount] = useState(1000);
  const [customRows, setCustomRows] = useState('');

  const handleGenerate = () => {
    const rows = customRows || rowCount;
    if (rows > maxRows) {
      alert(`Maximum ${maxRows.toLocaleString()} rows allowed`);
      return;
    }
    if (rows < 1) {
      alert('Please enter at least 1 row');
      return;
    }
    onGenerate(rows);
  };

  const handleQuickSelect = (count) => {
    setRowCount(count);
    setCustomRows('');
  };

  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Safe rendering helper
  const renderValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return value;
    return JSON.stringify(value);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate CSV</h2>

      {/* Row Count Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Number of Rows
        </label>
        
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[1000, 5000, 10000, 50000].map(count => (
            <button
              key={count}
              onClick={() => handleQuickSelect(count)}
              className={`py-3 rounded-lg font-medium transition ${
                rowCount === count && !customRows
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatNumber(count)}
            </button>
          ))}
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <input
              type="number"
              value={customRows}
              onChange={(e) => {
                setCustomRows(e.target.value);
                if (e.target.value) setRowCount(parseInt(e.target.value) || 0);
              }}
              placeholder={`Custom (max ${formatNumber(maxRows)})`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max={maxRows}
            />
          </div>
          <button
            onClick={() => handleQuickSelect(maxRows)}
            className="px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium whitespace-nowrap"
          >
            Max ({formatNumber(maxRows)})
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mt-2">
          Worker threads will process approximately {Math.ceil((customRows || rowCount) / 10000)} chunks in parallel
        </p>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generationStatus?.status === 'processing' || generationStatus?.status === 'starting'}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-4 rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition mb-6"
      >
        {(generationStatus?.status === 'processing' || generationStatus?.status === 'starting') ? (
          <span className="flex items-center justify-center">
            <FaSpinner className="animate-spin mr-3" />
            Generating with Worker Threads...
          </span>
        ) : (
          '🧵 Generate CSV with Worker Threads'
        )}
      </button>

      {/* Status Display */}
      {generationStatus && (
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              {generationStatus.status === 'completed' ? (
                <FaCheckCircle className="text-green-500 mr-2" />
              ) : generationStatus.status === 'failed' ? (
                <FaTimesCircle className="text-red-500 mr-2" />
              ) : (
                <FaSpinner className="animate-spin text-blue-500 mr-2" />
              )}
              <span className="font-medium text-gray-800 capitalize">
                {renderValue(generationStatus.status)}
                {(generationStatus.status === 'processing' || 
                  generationStatus.status === 'starting' || 
                  generationStatus.status === 'merging' || 
                  generationStatus.status === 'distributing') && '...'}
              </span>
            </div>
            
            {generationStatus.progress !== undefined && (
              <span className="font-bold text-gray-800">
                {renderValue(generationStatus.progress)}%
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {generationStatus.progress !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationStatus.progress}%` }}
              ></div>
            </div>
          )}

          {/* Status Details */}
          <div className="space-y-2 text-sm text-gray-600">
            {generationStatus.message && (
              <p>{renderValue(generationStatus.message)}</p>
            )}
            
            {generationStatus.fileSize && (
              <p>File size: <span className="font-medium">{renderValue(generationStatus.fileSize)}</span></p>
            )}
            
            {generationStatus.processingTime && (
              <p>Processing time: <span className="font-medium">{renderValue(generationStatus.processingTime)}</span></p>
            )}
            
            {generationStatus.totalChunks && (
              <p>Total chunks: <span className="font-medium">{renderValue(generationStatus.totalChunks)}</span></p>
            )}
            
            {generationStatus.status === 'completed' && (
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => onDownload(generationStatus.jobId)}
                  className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FaDownload className="mr-2" />
                  Download CSV File
                </button>
              </div>
            )}
            
            {generationStatus.status === 'failed' && generationStatus.error && (
              <p className="text-red-600">Error: {renderValue(generationStatus.error)}</p>
            )}
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="font-medium text-gray-700 mb-3">How Worker Threads Work</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• Large datasets are split into chunks (10,000 rows each)</p>
          <p>• Each chunk is processed by a separate worker thread</p>
          <p>• Main thread stays responsive while workers process data</p>
          <p>• Results are merged into a single CSV file</p>
          <p>• All metadata is stored in MongoDB</p>
        </div>
      </div>
    </div>
  );
}

export default GenerationPanel;