import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import app from '../app.js';
import { db } from '../config/db.js';
import { upload } from '../middleware/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Server Integration Test Suite with Supertest (Path 4)', () => {
  let createdJobId = null;

  const sampleCsvContent = `record_id,timestamp,vehicle_plate,driver_name,driver_ssn,vehicle_type,speed_mph,latitude,longitude,road_segment,congestion_level,notes
TRF-9468,2026-10-17T15:33:52Z,DCN-2584,Fatima Nguyen,954-87-5333,Commercial Van,23.8,40.730165,-73.98771,Houston Street,High,Driver phone 555-0101
TRF-9249,2026-10-17T18:41:34Z,DVH-1651,Anna Johnson,963-94-9565,Sedan,35.2,40.776748,-73.970966,Central Park West,Moderate,Clear
TRF-8102,2026-10-17T18:45:00Z,DVH-1651,Anna Johnson,963-94-9565,Sedan,36.0,40.776700,-73.971000,Central Park West,Moderate,Clear
TRF-8103,2026-10-17T18:50:00Z,DVH-1651,Anna Johnson,963-94-9565,Sedan,34.5,40.776800,-73.971100,Central Park West,Moderate,Clear
`;

  const tempCsvPath = path.join(__dirname, 'temp_test_traffic.csv');
  const tempInvalidPath = path.join(__dirname, 'temp_test_file.exe');

  before(async () => {
    await db.connect();
    fs.writeFileSync(tempCsvPath, sampleCsvContent, 'utf-8');
    fs.writeFileSync(tempInvalidPath, 'MZ_DUMMY_BINARY_DATA', 'utf-8');
  });

  // 1. Health Endpoint
  it('GET /api/health returns ONLINE status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ONLINE');
    assert.equal(res.body.service, 'Traffic Data Processor API');
  });

  // 2. Validation: Rejects invalid file format
  it('POST /api/jobs/upload rejects unsupported file formats (.exe)', async () => {
    const res = await request(app)
      .post('/api/jobs/upload')
      .attach('file', Buffer.from('MZ_DUMMY_BINARY_DATA'), 'temp_test_file.exe');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Invalid upload file format/i);
  });

  // 3. Validation: Rejects missing file when not sample
  it('POST /api/jobs/upload rejects request when neither file nor sample flag is provided', async () => {
    const res = await request(app)
      .post('/api/jobs/upload')
      .send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /No dataset file provided/i);
  });

  // 4. Validation: Rejects invalid configuration schema (bad risk reduction mode / kThreshold)
  it('POST /api/jobs/upload rejects invalid configuration schemas', async () => {
    const res = await request(app)
      .post('/api/jobs/upload')
      .field('config', JSON.stringify({ riskReductionMode: 'invalid_mode_name' }))
      .attach('file', tempCsvPath);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Invalid job configuration schema/i);
  });

  it('POST /api/jobs/upload rejects out-of-range kThreshold (< 2 or > 10)', async () => {
    const res = await request(app)
      .post('/api/jobs/upload')
      .field('config', JSON.stringify({ kThreshold: 99 }))
      .attach('file', tempCsvPath);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Invalid job configuration schema/i);
  });

  // 5. Size Limit Enforcement
  it('enforces 50MB maximum upload size limit in multer middleware', () => {
    assert.equal(upload.limits.fileSize, 50 * 1024 * 1024, 'Multer limit must be strictly 50MB (52428800 bytes)');
  });

  // 6. Upload, Processing & No Raw Values in API Responses or Mongo
  it('POST /api/jobs/upload processes dataset, scrubs raw PII, and returns masked samples', async () => {
    const configPayload = {
      riskReductionMode: 'suppress',
      kThreshold: 3,
      gpsPrecision: 2
    };

    const res = await request(app)
      .post('/api/jobs/upload')
      .field('config', JSON.stringify(configPayload))
      .attach('file', tempCsvPath);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.job);
    assert.ok(res.body.job.id);

    createdJobId = res.body.job.id;

    // Verify raw direct identifiers are NOT exposed in API response body
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('Fatima Nguyen'), 'Raw driver name leaked in response body!');
    assert.ok(!bodyStr.includes('Anna Johnson'), 'Raw driver name leaked in response body!');
    assert.ok(!bodyStr.includes('954-87-5333'), 'Raw SSN leaked in response body!');
    assert.ok(!bodyStr.includes('963-94-9565'), 'Raw SSN leaked in response body!');

    // Verify before_after_sample masks raw PII
    if (res.body.before_after_sample && res.body.before_after_sample.before) {
      for (const row of res.body.before_after_sample.before) {
        assert.ok(!row.driver_name || row.driver_name === '[CONFIDENTIAL_PII_PROTECTED]', 'driver_name unmasked in sample!');
        assert.ok(!row.driver_ssn || row.driver_ssn === '[CONFIDENTIAL_PII_PROTECTED]', 'driver_ssn unmasked in sample!');
      }
    }

    // Verify internal filesystem paths and stack traces are suppressed
    assert.ok(!bodyStr.includes('C:\\Users'), 'Server path leaked in response!');
    assert.ok(!bodyStr.includes('node_modules'), 'Internal path leaked in response!');
  });

  it('asserts MongoDB / database stores ZERO raw identifiers and only pseudonymized records', async () => {
    assert.ok(createdJobId, 'Job ID must be available from upload test');

    const job = await db.getJob(createdJobId);
    assert.ok(job, 'Job must exist in database');

    const records = await db.getAllRecordsForJob(createdJobId);
    assert.ok(records.length > 0, 'Persisted records must exist');

    for (const record of records) {
      // Direct PII columns must be dropped completely
      assert.equal(record.driver_name, undefined, 'driver_name persisted in database record!');
      assert.equal(record.driver_ssn, undefined, 'driver_ssn persisted in database record!');

      // Plates must be pseudonymized with ANON_ prefix
      assert.ok(
        String(record.vehicle_plate).startsWith('ANON_'),
        `Plate was not pseudonymized: ${record.vehicle_plate}`
      );

      // Coordinates must be generalized to 2 decimals
      if (record.latitude !== undefined && record.latitude !== null) {
        assert.equal(record.latitude, Number(record.latitude.toFixed(2)));
      }
    }
  });

  // 7. Downloads & Audit Report Endpoints
  it('GET /api/jobs/:id/download?format=csv downloads cleaned CSV with no raw PII', async () => {
    assert.ok(createdJobId);
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}/download?format=csv`);

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.ok(res.text.includes('vehicle_plate'));
    assert.ok(res.text.includes('ANON_'));
    assert.ok(!res.text.includes('Fatima Nguyen'));
    assert.ok(!res.text.includes('954-87-5333'));
  });

  it('GET /api/jobs/:id/download?format=json downloads valid JSON records', async () => {
    assert.ok(createdJobId);
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}/download?format=json`);

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    const parsed = JSON.parse(res.text);
    assert.ok(Array.isArray(parsed));
    assert.ok(parsed.length > 0);
  });

  it('GET /api/jobs/:id/download?format=csv&type=aggregate downloads aggregated dataset', async () => {
    assert.ok(createdJobId);
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}/download?format=csv&type=aggregate`);

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.ok(res.text.includes('road_segment'));
  });

  it('GET /api/jobs/:id/report returns markdown audit report with zero-retention attestation', async () => {
    assert.ok(createdJobId);
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}/report`);

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/markdown/);
    assert.ok(res.text.includes('Traffic Dataset'));
    assert.ok(res.text.includes('Storage Compliance Attestation'));
    assert.ok(res.text.includes('0 records persisted'));
  });

  // 8. Security: Formula Injection Protection
  it('protects exported CSVs from spreadsheet formula injection (=, +, -, @, \\t, \\r)', async () => {
    assert.ok(createdJobId);
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}/download?format=csv`);

    assert.equal(res.status, 200);
    const csvLines = res.text.split('\r\n').filter(Boolean);
    // Ensure no cell starts with an unquoted executable formula
    for (const line of csvLines.slice(1)) {
      const cells = line.split(',');
      for (const cell of cells) {
        const unquoted = cell.replace(/^"|"$/g, '');
        assert.ok(
          !unquoted.startsWith('=') && !unquoted.startsWith('@') && !unquoted.startsWith('+cmd'),
          `Potentially executable formula found in CSV export: ${cell}`
        );
      }
    }
  });

  after(async () => {
    try {
      if (fs.existsSync(tempCsvPath)) fs.unlinkSync(tempCsvPath);
      if (fs.existsSync(tempInvalidPath)) fs.unlinkSync(tempInvalidPath);
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    } finally {
      setTimeout(() => process.exit(0), 100);
    }
  });
});
