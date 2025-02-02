// File processor implementation
import JSZip from 'jszip';

const KEY = new Uint8Array([0xd6, 0x02, 0x08, 0x00, 0xf4, 0xfe, 0xff, 0x3f, 0x01, 0x00, 0x00, 0x00, 0xd0, 0xca, 0x01, 0x00]);

export class FileProcessor {
  private async xorData(data: ArrayBuffer): Promise<ArrayBuffer> {
    const view = new Uint8Array(data);
    const result = new Uint8Array(view.length);
    
    for (let i = 0; i < view.length; i++) {
      result[i] = view[i] ^ KEY[i % KEY.length];
    }
    
    return result.buffer;
  }

  private async processFile(
    file: File, 
    mode: 'encrypt' | 'decrypt',
    onProgress?: (progress: number) => void
  ): Promise<File> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let processedData: ArrayBuffer;

      if (mode === 'decrypt') {
        // Remove first 8 bytes and decrypt
        const dataWithout8Bytes = arrayBuffer.slice(8);
        const decryptedData = await this.xorData(dataWithout8Bytes);
        // Decompress using pako (zlib implementation)
        processedData = await new Response(
          new Blob([decryptedData]).stream().pipeThrough(new DecompressionStream('deflate'))
        ).arrayBuffer();
      } else {
        // Compress
        const compressedData = await new Response(
          new Blob([arrayBuffer]).stream().pipeThrough(new CompressionStream('deflate'))
        ).arrayBuffer();
        // Encrypt
        const encryptedData = await this.xorData(compressedData);
        // Add 8 bytes header
        const header = new Uint8Array(8).fill(0);
        const result = new Uint8Array(8 + encryptedData.byteLength);
        result.set(header);
        result.set(new Uint8Array(encryptedData), 8);
        processedData = result.buffer;
      }

      return new File([processedData], file.name, { type: file.type });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      throw error;
    }
  }

  async processFiles(
    files: File[], 
    mode: 'encrypt' | 'decrypt',
    onProgress?: (progress: number) => void
  ): Promise<ProcessedFile[]> {
    const results: ProcessedFile[] = [];
    const totalFiles = files.length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const processedFile = await this.processFile(file, mode);
        results.push({
          originalFile: file,
          processedFile,
          status: 'success'
        });
        
        if (onProgress) {
          onProgress((i + 1) / totalFiles * 100);
        }
      } catch (error) {
        results.push({
          originalFile: file,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'error'
        });
        
        if (onProgress) {
          onProgress((i + 1) / totalFiles * 100);
        }
      }
    }
    
    return results;
  }

  async createZipFromFiles(files: File[]): Promise<Blob> {
    const zip = new JSZip();
    
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      zip.file(file.name, arrayBuffer);
    }
    
    return await zip.generateAsync({ type: 'blob' });
  }
}

export interface ProcessedFile {
  originalFile: File;
  processedFile?: File;
  error?: string;
  status: 'success' | 'error';
}