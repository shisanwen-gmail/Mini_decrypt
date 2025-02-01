import React, { useCallback, useState, useEffect } from 'react';
import { Upload, Moon, Sun, Download } from 'lucide-react';
import { FileProcessor, ProcessedFile } from './lib/fileProcessor';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const fileProcessor = new FileProcessor();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(selectedFiles);
    setResults([]);
  };

  const handleEncrypt = async () => {
    setIsProcessing(true);
    try {
      const processedResults = await fileProcessor.processFiles(files, 'encrypt', setProgress);
      setResults(processedResults);
    } catch (error) {
      console.error('Encryption error:', error);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleDecrypt = async () => {
    setIsProcessing(true);
    try {
      const processedResults = await fileProcessor.processFiles(files, 'decrypt', setProgress);
      setResults(processedResults);
    } catch (error) {
      console.error('Decryption error:', error);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  }, []);

  const downloadResults = async () => {
    if (results.length === 1) {
      const result = results[0];
      if (result.status === 'success' && result.processedFile) {
        const url = URL.createObjectURL(result.processedFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.processedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } else if (results.length > 1) {
      const successfulFiles = results
        .filter((r): r is ProcessedFile & { processedFile: File } => 
          r.status === 'success' && r.processedFile !== undefined
        )
        .map(r => r.processedFile);
      
      if (successfulFiles.length > 0) {
        const zip = await fileProcessor.createZipFromFiles(successfulFiles);
        const url = URL.createObjectURL(zip);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'processed_files.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              File Processor
            </h1>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="mb-4">
              <label className="block mb-2">
                <span className="text-gray-700 dark:text-gray-200">Select files to process</span>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 dark:text-gray-300">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none">
                        <span>Upload files</span>
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          className="sr-only"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Up to 100MB per file
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Selected Files:</h3>
                <ul className="space-y-2">
                  {files.map((file, index) => (
                    <li key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <span className="text-gray-700 dark:text-gray-200">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={handleEncrypt}
                disabled={isProcessing || files.length === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Encrypt
              </button>
              <button
                onClick={handleDecrypt}
                disabled={isProcessing || files.length === 0}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Decrypt
              </button>
            </div>

            {isProcessing && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Processing... {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Results:</h3>
                <button
                  onClick={downloadResults}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
              <ul className="space-y-2">
                {results.map((result, index) => (
                  <li
                    key={index}
                    className={`p-3 rounded-lg ${
                      result.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${
                        result.status === 'success'
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        {result.originalFile.name}
                      </span>
                      <span className={`text-sm ${
                        result.status === 'success'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {result.status === 'success' ? 'Success' : 'Error'}
                      </span>
                    </div>
                    {result.error && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {result.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;