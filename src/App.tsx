import React, { useCallback, useState, useEffect, lazy } from 'react';
import { FileProcessor, ProcessedFile } from './lib/fileProcessor';
import { Upload, Lock, Unlock, FolderUp, FileUp, Download, Archive, Sun, Moon } from 'lucide-react';

// 使用 React.memo 优化图标组件
const IconWrapper = React.memo(({ icon: Icon, ...props }) => <Icon {...props} />);

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [isFolder, setIsFolder] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours();
      setIsDarkMode(hour >= 20 || hour < 8);
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = 100 * 1024 * 1024;
    const validFiles = Array.from(files).filter(file => {
      if (file.size > maxSize) {
        alert(`文件 ${file.name} 超过100MB限制`);
        return false;
      }
      return true;
    });

    setFiles(validFiles);
    setIsFolder(!!e.target.getAttribute('webkitdirectory'));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      
      const maxSize = 100 * 1024 * 1024;
      const validFiles = files.filter(file => {
        if (file.size > maxSize) {
          alert(`文件 ${file.name} 超过100MB限制`);
          return false;
        }
        return true;
      });

      setFiles(validFiles);
      const paths = new Set(files.map(file => file.webkitRelativePath.split('/')[0]));
      setIsFolder(paths.size > 1 || (files[0]?.webkitRelativePath?.includes('/') ?? false));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const processFiles = async () => {
    if (files.length === 0) return;

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 500 * 1024 * 1024;
    if (totalSize > maxTotalSize) {
      alert('总文件大小超过500MB限制');
      return;
    }

    setProcessing(true);
    setProgress(0);

    try {
      const processor = new FileProcessor();
      const processedFiles = await processor.processFiles(files, mode, (progress) => {
        setProgress(progress);
      });
      setResults(processedFiles);
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = useCallback(async (processedFile: File) => {
    const url = URL.createObjectURL(processedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = processedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadZip = useCallback(async () => {
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      
      const successfulFiles = results
        .filter((result): result is ProcessedFile & { processedFile: File } => 
          result.status === 'success' && !!result.processedFile
        )
        .map(result => result.processedFile);
      
      if (successfulFiles.length === 0) return;

      for (const file of successfulFiles) {
        const arrayBuffer = await file.arrayBuffer();
        zip.file(file.name, arrayBuffer);
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed_files_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('创建ZIP文件时出错');
    }
  }, [results]);

  return (
    <div className={`min-h-screen py-8 px-4 transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <IconWrapper 
              icon={isDarkMode ? Moon : Sun} 
              className={isDarkMode ? "w-6 h-6 text-yellow-400" : "w-6 h-6 text-yellow-500"} 
            />
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            迷你世界文件加解密工具
          </h1>
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
            支持所有文件格式
          </p>
        </div>

        <div className={`rounded-lg shadow-md p-6 ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setMode('encrypt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                mode === 'encrypt'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <IconWrapper icon={Lock} size={20} />
              加密
            </button>
            <button
              onClick={() => setMode('decrypt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                mode === 'decrypt'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <IconWrapper icon={Unlock} size={20} />
              解密
            </button>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              isDarkMode ? 'border-gray-600' : 'border-gray-300'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="flex flex-col items-center gap-4">
              <IconWrapper icon={Upload} className={isDarkMode ? 'text-gray-400' : 'text-gray-400'} />
              <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                拖拽文件到这里，或者点击下方按钮选择文件
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700">
                  <IconWrapper icon={FileUp} size={20} />
                  选择文件
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700">
                  <IconWrapper icon={FolderUp} size={20} />
                  选择文件夹
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    webkitdirectory="true"
                  />
                </label>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-4">
              <h3 className={`font-semibold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>已选择的文件：</h3>
              <ul className={`text-sm max-h-40 overflow-y-auto ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {files.map((file, index) => (
                  <li key={index} className="mb-1">
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </li>
                ))}
              </ul>
              <button
                onClick={processFiles}
                disabled={processing}
                className={`mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {processing ? '处理中...' : '开始处理'}
              </button>
            </div>
          )}

          {processing && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className={`text-center text-sm mt-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                处理进度: {progress.toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className={`rounded-lg shadow-md p-6 mt-6 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>处理结果：</h3>
              {isFolder && (
                <button
                  onClick={downloadZip}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <IconWrapper icon={Archive} size={20} />
                  下载所有文件 (ZIP)
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {results.map((result, index) => (
                <li
                  key={index}
                  className={`p-3 rounded-md ${
                    result.status === 'success'
                      ? isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
                      : isDarkMode ? 'bg-red-900/20' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-900'
                    }`}>
                      {result.originalFile.name}
                      {result.status === 'error' && (
                        <span className="text-red-600 ml-2">
                          - 错误: {result.error}
                        </span>
                      )}
                    </span>
                    {result.status === 'success' && result.processedFile && !isFolder && (
                      <button
                        onClick={() => downloadFile(result.processedFile!)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <IconWrapper icon={Download} size={16} />
                        下载
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`text-center mt-8 text-sm ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <p>作者：是史三问呀</p>
          <p>QQ：2196634956</p>
        </div>
      </div>
    </div>
  );
}

export default App;