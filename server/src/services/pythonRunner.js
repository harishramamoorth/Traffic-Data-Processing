import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to processor/main.py
const PROCESSOR_SCRIPT = path.resolve(__dirname, '../../../processor/main.py');
const TIMEOUT_MS = 60000; // 60-second processing execution timeout

/**
 * Runs dataset profiling in memory without executing processing or persisting data.
 * @param {string|null} filePath - Absolute path to uploaded temp file.
 * @param {boolean} sample - Whether to use synthetic test dataset.
 * @returns {Promise<object>} Parsed profile output.
 */
export function runPythonProfiler(filePath, sample = false) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = env.PYTHON_PATH;
    const args = [
      PROCESSOR_SCRIPT,
      '--profile'
    ];

    if (sample || !filePath) {
      args.push('--sample');
    } else {
      args.push('--input', filePath);
    }

    console.log(`[PythonRunner] Profiling dataset: ${pythonExecutable} ${args.join(' ')}`);

    let timedOut = false;
    const child = spawn(pythonExecutable, args, {
      cwd: path.dirname(PROCESSOR_SCRIPT),
      env: {
        ...process.env,
        HASH_SECRET: env.HASH_SECRET,
        PYTHONUNBUFFERED: '1'
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`Dataset profiling timed out after ${TIMEOUT_MS / 1000} seconds.`));
    }, TIMEOUT_MS);

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        console.error(`[PythonRunner] Profiler exited with code ${code}:`, stderrData);
        return reject(new Error(stderrData.trim() || `Dataset profiling failed with exit code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (parseError) {
        reject(new Error(`Failed to parse profiler JSON response: ${parseError.message}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Python profiler: ${err.message}`));
    });
  });
}

/**
 * Executes the Python processing engine with real-time progress callbacks and dynamic configuration overrides.
 * @param {string|null} filePath - Absolute path to uploaded input file.
 * @param {object|string|null} configOverride - Dynamic JSON configuration override.
 * @param {Function|null} onProgress - Callback for real-time progress events ({ type, stage, percent, message }).
 * @param {boolean} sample - Whether to run on sample dataset.
 * @returns {Promise<object>} Parsed output payload from Python pipeline.
 */
export function runPythonProcessor(filePath, configOverride = null, onProgress = null, sample = false) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = env.PYTHON_PATH;
    const args = [
      PROCESSOR_SCRIPT,
      '--hash-secret',
      env.HASH_SECRET
    ];

    if (sample || !filePath) {
      args.push('--sample');
    } else {
      args.push('--input', filePath);
    }

    if (configOverride) {
      const configJsonStr = typeof configOverride === 'string' ? configOverride : JSON.stringify(configOverride);
      args.push('--config-json', configJsonStr);
    }

    console.log(`[PythonRunner] Spawning: ${pythonExecutable} ${args.join(' ')}`);

    let timedOut = false;
    const child = spawn(pythonExecutable, args, {
      cwd: path.dirname(PROCESSOR_SCRIPT),
      env: {
        ...process.env,
        HASH_SECRET: env.HASH_SECRET,
        PYTHONUNBUFFERED: '1'
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`Python processing timed out after ${TIMEOUT_MS / 1000} seconds.`));
    }, TIMEOUT_MS);

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrData += text;

      if (onProgress) {
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Parse stage progress: [STAGE:stage_name:pct] message
          const stageMatch = trimmed.match(/^\[STAGE:([a-zA-Z0-9_]+):(\d+)\]\s*(.*)$/);
          if (stageMatch) {
            onProgress({
              type: 'stage',
              stage: stageMatch[1],
              percent: parseInt(stageMatch[2], 10),
              message: stageMatch[3]
            });
            continue;
          }

          // Parse log line: [LOG] message
          const logMatch = trimmed.match(/^\[LOG\]\s*(.*)$/);
          if (logMatch) {
            onProgress({
              type: 'log',
              message: logMatch[1]
            });
            continue;
          }
        }
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        console.error(`[PythonRunner] Pipeline exited with error code ${code}:`, stderrData);
        let errorMsg = stderrData.trim();
        try {
          const parsedErr = JSON.parse(stderrData.trim());
          if (parsedErr.error) errorMsg = parsedErr.error;
        } catch {
          // Keep raw string if not JSON
        }
        return reject(new Error(errorMsg || `Data processing failed with exit code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (parseError) {
        console.error('[PythonRunner] JSON parse error. Raw stdout snippet:', stdoutData.slice(0, 300));
        reject(
          new Error(
            `Failed to parse pipeline JSON response: ${parseError.message}. Details: ${stderrData || 'None'}`
          )
        );
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      console.error('[PythonRunner] Process spawn error:', err);
      reject(new Error(`Failed to start Python processor: ${err.message}`));
    });
  });
}
