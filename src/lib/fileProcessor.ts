import JSZip from 'jszip';

// 使用 Web Crypto API 生成安全的密钥
const generateKey = async () => {
  try {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to generate key:', error);
    throw new Error('密钥生成失败');
  }
};

// 优化的加密实现
const encryptData = async (data: ArrayBuffer, key: CryptoKey) => {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );
    
    const result = new Uint8Array(iv.length + encryptedContent.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encryptedContent), iv.length);
    return result.buffer;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('加密失败');
  }
};

// 优化的解密实现
const decryptData = async (data: ArrayBuffer, key: CryptoKey) => {
  try {
    const iv = new Uint8Array(data.slice(0, 12));
    const encryptedContent = new Uint8Array(data.slice(12));
    
    return await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encryptedContent
    );
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('解密失败');
  }
};

// 优化工作线程池大小
const WORKER_POOL_SIZE = Math.max(2, Math.min(navigator.hardwareConcurrency || 4, 8));
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for better memory management

export class FileProcessor {
  private key: CryptoKey | null = null;
  private processingQueue: Array<() => Promise<void>> = [];
  private activeProcesses = 0;

  constructor() {
    this.initializeKey();
  }

  private async initializeKey() {
    try {
      this.key = await generateKey();
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error('加密系统初始化失败');
    }
  }

  private async processChunk(chunk: ArrayBuffer, mode: 'encrypt' | 'decrypt'): Promise<ArrayBuffer> {
    if (!this.key) {
      throw new Error('加密系统未初始化');
    }

    try {
      return mode === 'encrypt' 
        ? await encryptData(chunk, this.key)
        : await decryptData(chunk, this.key);
    } catch (error) {
      console.error(`Error processing chunk:`, error);
      throw new Error(mode === 'encrypt' ? '加密失败' : '解密失败');
    }
  }

  private async processFileInChunks(
    file: File,
    mode: 'encrypt' | 'decrypt',
    onProgress?: (progress: number) => void
  ): Promise<File> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunks: ArrayBuffer[] = [];
    let processedChunks = 0;

    const processNextChunk = async (start: number): Promise<void> => {
      if (start >= file.size) return;

      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = await file.slice(start, end).arrayBuffer();
      
      try {
        const processedChunk = await this.processChunk(chunk, mode);
        chunks.push(processedChunk);
        processedChunks++;
        
        if (onProgress) {
          onProgress((processedChunks / totalChunks) * 100);
        }
      } catch (error) {
        throw new Error(`处理文件 ${file.name} 时出错: ${error.message}`);
      }
    };

    const chunkPromises: Promise<void>[] = [];
    for (let start = 0; start < file.size; start += CHUNK_SIZE) {
      chunkPromises.push(processNextChunk(start));
    }

    await Promise.all(chunkPromises);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return new File([result], file.name, { type: file.type });
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('无效的文件');
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new Error(`文件 ${file.name} 超过100MB限制`);
    }

    const safeFilenameRegex = /^[a-zA-Z0-9-_. ]+$/;
    if (!safeFilenameRegex.test(file.name)) {
      throw new Error(`文件名 ${file.name} 包含不安全字符`);
    }
  }

  private async processQueue() {
    while (this.processingQueue.length > 0 && this.activeProcesses < WORKER_POOL_SIZE) {
      const task = this.processingQueue.shift();
      if (task) {
        this.activeProcesses++;
        try {
          await task();
        } catch (error) {
          console.error('Task processing error:', error);
        } finally {
          this.activeProcesses--;
          this.processQueue();
        }
      }
    }
  }

  async processFiles(
    files: File[],
    mode: 'encrypt' | 'decrypt',
    onProgress?: (progress: number) => void
  ): Promise<ProcessedFile[]> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('请选择要处理的文件');
    }

    const results: ProcessedFile[] = new Array(files.length);
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > 500 * 1024 * 1024) {
      throw new Error('总文件大小超过500MB限制');
    }

    const tasks = files.map((file, index) => {
      return new Promise<void>((resolve) => {
        const task = async () => {
          try {
            this.validateFile(file);
            const processedFile = await this.processFileInChunks(file, mode, (chunkProgress) => {
              if (onProgress) {
                const fileProgress = (index / totalFiles) * 100 + (chunkProgress / totalFiles);
                onProgress(Math.min(fileProgress, 100));
              }
            });
            
            results[index] = {
              originalFile: file,
              processedFile,
              status: 'success'
            };
          } catch (error) {
            results[index] = {
              originalFile: file,
              error: error instanceof Error ? error.message : '未知错误',
              status: 'error'
            };
          }
          resolve();
        };
        
        this.processingQueue.push(task);
        this.processQueue();
      });
    });

    await Promise.all(tasks);
    return results;
  }

  async createZipFromFiles(files: File[]): Promise<Blob> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('没有可打包的文件');
    }

    const zip = new JSZip();
    
    for (const file of files) {
      try {
        this.validateFile(file);
        const arrayBuffer = await file.arrayBuffer();
        zip.file(file.name, arrayBuffer, {
          compression: 'DEFLATE',
          compressionOptions: {
            level: 6
          }
        });
      } catch (error) {
        console.error(`Error adding file to zip: ${file.name}`, error);
        throw new Error(`创建ZIP文件时出错: ${error.message}`);
      }
    }
    
    return await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      },
      streamFiles: true
    });
  }
}

export interface ProcessedFile {
  originalFile: File;
  processedFile?: File;
  error?: string;
  status: 'success' | 'error';
}