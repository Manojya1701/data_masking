'use strict';

/**
 * ORC Handler
 * Delegates to a Python helper using PyArrow for ORC read/write.
 * Requires python3 and pyarrow installed on the host.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { encrypt } = require('../services/encryption-service');
const { makeOutputPath } = require('./handler-utils');

const PYTHON_HELPER = path.join(__dirname, '../python-helpers/orc_processor.py');

function runPython(config) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [PYTHON_HELPER], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', d => (stdout += d.toString()));
    py.stderr.on('data', d => (stderr += d.toString()));
    py.on('error', err => reject(new Error(`Failed to spawn Python: ${err.message}. Ensure python3 is installed.`)));
    py.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Python helper exited with code ${code}: ${stderr.trim()}`));
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Python helper returned invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });

    py.stdin.write(JSON.stringify(config));
    py.stdin.end();
  });
}

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const encrypted = encrypt(plaintext, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  const outPath = makeOutputPath(outputDir, originalName, operation);

  const config = {
    input_path: filePath,
    output_path: outPath,
    operation,
    algorithm: options.algorithm || 'sha256',
  };

  const result = await runPython(config);
  return {
    outputPath: outPath,
    count: result.count || 0,
    notes: result.notes || ['ORC processed via Python/PyArrow.'],
  };
}

module.exports = { process };
