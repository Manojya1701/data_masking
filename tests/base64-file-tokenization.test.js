'use strict';

/**
 * base64-file-tokenization.test.js
 * End-to-end tests for Reversible Base64 Tokenization & Detokenization in UDPS.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const http = require('http');
const { processFile } = require('../backend/services/privacy-engine');
const { detokenizeFile, maskValue, base64Tokenize, detokenizeBase64Text } = require('../backend/handlers/mask-utils');
const processRoutes = require('../backend/routes/process.routes');

const TMP = os.tmpdir();

describe('Base64 File Tokenization & Restore Pipeline', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use('/api', processRoutes);
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('1. Unit Tokenization & De-Tokenization', () => {
    test('Encodes plaintext into BASE64[...] wrapper', () => {
      const plain = 'vikram@example.com';
      const token = base64Tokenize(plain);
      expect(token).toBe('BASE64[dmlrcmFtQGV4YW1wbGUuY29t]');
    });

    test('detokenizeBase64Text cleanly restores embedded tokens', () => {
      const text = 'Customer BASE64[UmFtIEt1bWFy] phone BASE64[OTg3NjU0MzIxMA==]';
      const restored = detokenizeBase64Text(text);
      expect(restored.count).toBe(2);
      expect(restored.text).toBe('Customer Ram Kumar phone 9876543210');
    });

    test('maskValue routes base64 to base64Tokenize', () => {
      const masked = maskValue('ABCDE1234F', null, 'base64');
      expect(masked).toBe('BASE64[QUJDREUxMjM0Rg==]');
    });
  });

  describe('2. CSV Full Round-trip Processing', () => {
    test('processFile masks sensitive columns with Base64 and restores cleanly', async () => {
      const inputCsv = 'id,name,email,salary\n1,Vikram Patel,vikram@example.com,75000\n2,Priya Sharma,priya@example.com,82000\n';
      const inputPath = path.join(TMP, `test_input_${Date.now()}.csv`);
      fs.writeFileSync(inputPath, inputCsv, 'utf8');

      // Step 1: Protect using operation: 'mask', maskingType: 'base64'
      const maskedResult = await processFile({
        filePath: inputPath,
        originalName: 'employees.csv',
        outputDir: TMP,
        operation: 'mask',
        options: { maskingType: 'base64' },
      });

      expect(maskedResult.count).toBeGreaterThan(0);
      const maskedContent = fs.readFileSync(maskedResult.outputPath, 'utf8');
      expect(maskedContent).toContain('BASE64[');
      expect(maskedContent).not.toContain('vikram@example.com');
      expect(maskedContent).not.toContain('priya@example.com');

      // Step 2: Detokenize the file
      const detokResult = detokenizeFile(Buffer.from(maskedContent), 'employees_masked.csv');
      expect(detokResult.count).toBeGreaterThan(0);
      const restoredCsv = detokResult.restoredContent.toString('utf8');

      expect(restoredCsv).toContain('vikram@example.com');
      expect(restoredCsv).toContain('priya@example.com');
      expect(restoredCsv).toContain('Vikram Patel');
      expect(restoredCsv).toContain('Priya Sharma');
      expect(restoredCsv).not.toContain('BASE64[');

      // Cleanup
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(maskedResult.outputPath); } catch {}
    });
  });

  describe('3. JSON Full Round-trip Processing', () => {
    test('processFile masks sensitive JSON fields with Base64 and detokenizes back', async () => {
      const inputJson = JSON.stringify({
        customer: {
          fullName: 'Ananya Roy',
          emailAddress: 'ananya@segmento.io',
          status: 'active',
        },
      }, null, 2);

      const inputPath = path.join(TMP, `test_input_${Date.now()}.json`);
      fs.writeFileSync(inputPath, inputJson, 'utf8');

      const maskedResult = await processFile({
        filePath: inputPath,
        originalName: 'customer.json',
        outputDir: TMP,
        operation: 'mask',
        options: { maskingType: 'base64' },
      });

      expect(maskedResult.count).toBeGreaterThan(0);
      const maskedContent = fs.readFileSync(maskedResult.outputPath, 'utf8');
      expect(maskedContent).toContain('BASE64[');

      const detokResult = detokenizeFile(Buffer.from(maskedContent), 'customer_masked.json');
      expect(detokResult.count).toBeGreaterThan(0);
      const restoredObj = JSON.parse(detokResult.restoredContent.toString('utf8'));

      expect(restoredObj.customer.emailAddress).toBe('ananya@segmento.io');
      expect(restoredObj.customer.fullName).toBe('Ananya Roy');
      expect(restoredObj.customer.status).toBe('active');

      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(maskedResult.outputPath); } catch {}
    });
  });

  describe('4. Detokenize API Endpoint (POST /api/detokenize-file)', () => {
    test('Accepts tokenized CSV upload, restores file, and issues preview/download token', async () => {
      const tokenizedCsv = 'name,email,dept\nBASE64[Sm9obiBEb2U=],BASE64[am9obkBleGFtcGxlLmNvbQ==],Engineering\n';
      const boundary = '----WebKitFormBoundaryTest123456';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="staff_tokenized.csv"',
        'Content-Type: text/csv',
        '',
        tokenizedCsv,
        `--${boundary}--`,
        '',
      ].join('\r\n');

      const response = await fetch(`${baseUrl}/api/detokenize-file`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.from(body),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.detokenizedCount).toBe(2);
      expect(data.downloadName).toBe('staff_tokenized_restored.csv');
      expect(data.token).toBeDefined();

      // Verify preview endpoint recovers the restored plaintext
      const previewResp = await fetch(`${baseUrl}/api/preview/${data.token}`);
      expect(previewResp.status).toBe(200);
      const previewText = await previewResp.text();
      expect(previewText).toContain('John Doe');
      expect(previewText).toContain('john@example.com');
      expect(previewText).toContain('Engineering');
      expect(previewText).not.toContain('BASE64[');
    });
  });
});
