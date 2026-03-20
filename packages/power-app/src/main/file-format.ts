import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import * as unzipper from 'unzipper';

const MAGIC_HEADER = 'EUNOISTORIA\0';
const VERSION = 0x0001;
const RESERVED = 0x0000;
const XOR_KEY = 0x42;

/**
 * FileFormat handles encoding and decoding of .eunoistoria files.
 * Format: magic header (12 bytes) + version (2 bytes) + reserved (2 bytes) + XOR'd ZIP
 */
export class FileFormat {
  /**
   * Encode SQLite database to .eunoistoria file format
   * @param sqliteBuffer - The SQLite database buffer
   * @param outputPath - Path where to write the .eunoistoria file
   * @returns Buffer containing the encoded file (also written to disk)
   */
  static async encode(sqliteBuffer: Buffer, outputPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create archive in memory
        const archive = archiver('zip', { zlib: { level: 6 } });
        const chunks: Buffer[] = [];

        archive.on('data', (chunk) => {
          chunks.push(chunk);
        });

        archive.on('error', (err) => {
          reject(new Error(`Failed to create zip: ${err.message}`));
        });

        archive.on('end', () => {
          try {
            // Combine all chunks into single ZIP buffer
            const zipBuffer = Buffer.concat(chunks);

            // Create header
            const header = Buffer.alloc(16);
            header.write(MAGIC_HEADER, 0, 12, 'utf-8');
            header.writeUInt16LE(VERSION, 12);
            header.writeUInt16LE(RESERVED, 14);

            // XOR first 4 bytes of ZIP
            const xorBuffer = Buffer.alloc(zipBuffer.length);
            for (let i = 0; i < zipBuffer.length; i++) {
              xorBuffer[i] = i < 4 ? zipBuffer[i] ^ XOR_KEY : zipBuffer[i];
            }

            // Combine header + XOR'd ZIP
            const eunostoriaFile = Buffer.concat([header, xorBuffer]);

            // Write to disk
            fs.writeFileSync(outputPath, eunostoriaFile);

            resolve(eunostoriaFile);
          } catch (err) {
            reject(err);
          }
        });

        // Add SQLite database to archive
        archive.append(sqliteBuffer, { name: 'db.sqlite' });
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Decode .eunoistoria file to SQLite database buffer
   * @param filePath - Path to the .eunoistoria file
   * @returns Buffer containing the SQLite database
   */
  static async decode(filePath: string): Promise<Buffer> {
    try {
      // Read file
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const fileBuffer = fs.readFileSync(filePath);

      // Validate file size (at least 16 bytes for header)
      if (fileBuffer.length < 16) {
        throw new Error('This file is not a valid .eunoistoria project');
      }

      // Extract and validate magic header
      const magic = fileBuffer.slice(0, 12).toString('utf-8');
      if (magic !== MAGIC_HEADER) {
        throw new Error('This file is not a valid .eunoistoria project');
      }

      // Extract and validate version
      const version = fileBuffer.readUInt16LE(12);
      if (version !== VERSION) {
        throw new Error('This file was created with a newer version of Eunoistoria');
      }

      // Extract ZIP data (bytes 16+)
      const xorZip = fileBuffer.slice(16);

      // Reverse XOR on first 4 bytes
      const zipBuffer = Buffer.alloc(xorZip.length);
      for (let i = 0; i < xorZip.length; i++) {
        zipBuffer[i] = i < 4 ? xorZip[i] ^ XOR_KEY : xorZip[i];
      }

      // Extract from ZIP using unzipper
      return new Promise((resolve, reject) => {
        try {
          const { Readable } = require('stream');
          const stream = Readable.from(zipBuffer);

          stream
            .pipe(unzipper.Parse())
            .on('entry', (entry: any) => {
              const fileName = entry.path;

              if (fileName === 'db.sqlite') {
                const chunks: Buffer[] = [];

                entry.on('data', (chunk: Buffer) => {
                  chunks.push(chunk);
                });

                entry.on('end', () => {
                  resolve(Buffer.concat(chunks));
                });

                entry.on('error', () => {
                  reject(new Error('Failed to extract project file (corrupted or incomplete)'));
                });
              } else {
                entry.autodrain();
              }
            })
            .on('error', (err: Error) => {
              reject(new Error('Failed to extract project file (corrupted or incomplete)'));
            });
        } catch (err) {
          reject(new Error('Failed to extract project file (corrupted or incomplete)'));
        }
      });
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to decode .eunoistoria file');
    }
  }
}
