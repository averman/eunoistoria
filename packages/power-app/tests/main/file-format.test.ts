import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileFormat } from '../../src/main/file-format';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileFormat', () => {
  const MAGIC_HEADER = 'EUNOISTORIA\0';
  const VERSION = 0x0001;
  const RESERVED = 0x0000;
  const XOR_KEY = 0x42;
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eunoistoria-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('TC-PA002-11: Encode .eunoistoria file', () => {
    it('should create valid .eunoistoria with magic header', async () => {
      const sqliteBuffer = Buffer.from('SQLite format 3\0test data');
      const outputPath = path.join(tempDir, 'test.eunoistoria');

      const result = await FileFormat.encode(sqliteBuffer, outputPath);

      // Assert: File was written
      expect(fs.existsSync(outputPath)).toBe(true);

      // Assert: Result is a Buffer
      expect(result).toBeInstanceOf(Buffer);

      // Assert: Magic header present
      const magic = result.slice(0, 12).toString('utf-8');
      expect(magic).toBe(MAGIC_HEADER);

      // Assert: Version in bytes 12-13
      const version = result.readUInt16LE(12);
      expect(version).toBe(VERSION);

      // Assert: Reserved bytes 14-15
      const reserved = result.readUInt16LE(14);
      expect(reserved).toBe(RESERVED);

      // Assert: ZIP data starts at byte 16
      expect(result.length).toBeGreaterThan(16);
    });
  });

  describe('TC-PA002-12: Decode .eunoistoria file', () => {
    it('should validate magic header and extract database', async () => {
      // Setup: Create a valid .eunoistoria file
      const originalBuffer = Buffer.from('SQLite format 3\0test content');
      const encodePath = path.join(tempDir, 'encode-test.eunoistoria');

      await FileFormat.encode(originalBuffer, encodePath);

      // Decode should not throw
      const result = await FileFormat.decode(encodePath);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('TC-PA002-13: Roundtrip integrity', () => {
    it('should preserve data through encode → decode cycle', async () => {
      const originalBuffer = Buffer.from('SQLite format 3\0content here for roundtrip test');
      const encodePath = path.join(tempDir, 'roundtrip.eunoistoria');

      // Encode
      await FileFormat.encode(originalBuffer, encodePath);

      // Decode
      const decoded = await FileFormat.decode(encodePath);

      // Assert: Decoded matches original
      expect(decoded).toEqual(originalBuffer);
    });
  });

  describe('TC-PA002-14: Invalid magic header', () => {
    it('should throw error for file with wrong magic bytes', async () => {
      // Create file with invalid magic
      const invalidFile = path.join(tempDir, 'invalid.eunoistoria');
      const invalidHeader = Buffer.alloc(16);
      invalidHeader.write('INVALID_MAGIC', 0, 12, 'utf-8');
      fs.writeFileSync(invalidFile, invalidHeader);

      // Assert: Throws appropriate error
      await expect(FileFormat.decode(invalidFile)).rejects.toThrow(
        'This file is not a valid .eunoistoria project'
      );
    });
  });

  describe('TC-PA002-15: Version mismatch', () => {
    it('should throw error for unsupported version', async () => {
      // Create file with valid magic but wrong version
      const futureFile = path.join(tempDir, 'future.eunoistoria');
      const header = Buffer.alloc(16);
      header.write(MAGIC_HEADER, 0, 12, 'utf-8');
      header.writeUInt16LE(0x0002, 12); // Version 2 (unsupported)
      header.writeUInt16LE(RESERVED, 14);
      fs.writeFileSync(futureFile, header);

      // Assert: Throws appropriate error
      await expect(FileFormat.decode(futureFile)).rejects.toThrow(
        'This file was created with a newer version of Eunoistoria'
      );
    });
  });

  describe('TC-PA002-16: Corrupted ZIP', () => {
    it('should throw error for invalid ZIP data', async () => {
      // Create file with valid header but corrupted ZIP
      const corruptFile = path.join(tempDir, 'corrupt.eunoistoria');
      const header = Buffer.alloc(16);
      header.write(MAGIC_HEADER, 0, 12, 'utf-8');
      header.writeUInt16LE(VERSION, 12);
      header.writeUInt16LE(RESERVED, 14);

      const invalidZip = Buffer.from('CORRUPTED_DATA_NOT_A_ZIP');
      const file = Buffer.concat([header, invalidZip]);
      fs.writeFileSync(corruptFile, file);

      // Assert: Throws appropriate error
      await expect(FileFormat.decode(corruptFile)).rejects.toThrow(
        'Failed to extract project file (corrupted or incomplete)'
      );
    });
  });

  describe('TC-PA002-17: XOR obfuscation verification', () => {
    it('should correctly apply and reverse XOR to ZIP data', async () => {
      // Create a minimal valid .eunoistoria and verify XOR is applied
      const testBuffer = Buffer.from('test data for XOR verification');
      const xorPath = path.join(tempDir, 'xor-test.eunoistoria');

      const encoded = await FileFormat.encode(testBuffer, xorPath);

      // Verify first 4 bytes are XOR'd (ZIP signature PK..03.04)
      // We expect the first byte to not be 'P' (0x50) if XOR was applied
      const firstByte = encoded[16];
      const normalPK = 0x50;
      expect(firstByte).not.toBe(normalPK);

      // Verify that after un-XORing, we get valid ZIP
      expect((firstByte ^ XOR_KEY)).toBe(normalPK); // 'P'
    });
  });
});
