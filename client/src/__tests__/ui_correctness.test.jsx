import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import Step3Configure, {
  getAllowedActionsForColumn,
  getMaskedSampleDisplay,
  buildJobPayloadConfig
} from '../components/wizard/Step3Configure.jsx';
import { jsonToCsv, getCleanedDownloadFilename } from '../utils/downloader.js';
import { useWorkflowStore } from '../store/useWorkflowStore.js';
import { ToastProvider } from '../components/Toast.jsx';

describe('UI Correctness & Action Filtering (Path 3)', () => {
  it('generates download filenames using original uploaded file name with _cleaned suffix', () => {
    expect(getCleanedDownloadFilename('Vendor_Quotes.xlsx', 'csv')).toBe('Vendor_Quotes_cleaned.csv');
    expect(getCleanedDownloadFilename('Vendor_Quotes.xlsx', 'xlsx')).toBe('Vendor_Quotes_cleaned.xlsx');
    expect(getCleanedDownloadFilename('traffic_data_2026.csv', 'json')).toBe('traffic_data_2026_cleaned.json');
    expect(getCleanedDownloadFilename('data_cleaned.csv', 'csv')).toBe('data_cleaned.csv');
    expect(getCleanedDownloadFilename('sample.csv', 'csv', true)).toBe('sample_cleaned_aggregated.csv');
  });

  it('formats generalized coordinates to two decimals in CSV exports', () => {
    const csv = jsonToCsv(
      [{ latitude: 40.7, longitude: -74 }],
      { formatCoordinates: true }
    );

    expect(csv).toBe('latitude,longitude\r\n"40.70","-74.00"');
  });

  it('shows all profiled columns and distinguishes standard attributes from sensitive fields', () => {
    const columns = [
      ['timestamp', 'datetime', 'TIME_BUCKET'],
      ['latitude', 'coordinates', 'GENERALIZE_SPATIAL'],
      ['longitude', 'coordinates', 'GENERALIZE_SPATIAL'],
      ['plate', 'plate_number', 'PSEUDONYMIZE_HMAC'],
      ['vehicle_type', 'data_attribute', 'KEEP'],
      ['speed_mph', 'data_attribute', 'KEEP'],
      ['congestion', 'data_attribute', 'KEEP'],
      ['road_segment', 'location_identifier', 'REDACT'],
      ['driver_name', 'driver_name', 'DROP_COLUMN'],
    ].map(([name, category, default_action]) => ({
      name,
      column: name,
      category,
      classification: category === 'data_attribute' ? 'Numeric Attribute' : name,
      default_action,
      confidence: 0.9,
      risk_badge: category === 'data_attribute' ? 'LOW' : 'MEDIUM',
      first_non_null_value: '',
    }));
    useWorkflowStore.getState().resetWorkflow();
    useWorkflowStore.getState().setProfileData({ pii_columns: columns });

    const { container } = render(
      <ToastProvider>
        <Step3Configure />
      </ToastProvider>
    );

    expect(screen.getByText(/Showing 9 of 9/)).toBeDefined();
    for (const name of [
      'timestamp', 'latitude', 'longitude', 'plate', 'vehicle_type',
      'speed_mph', 'congestion', 'road_segment', 'driver_name',
    ]) {
      expect(container.querySelector(`[data-pii-card="${name}"]`)).not.toBeNull();
    }
    expect(screen.getAllByText('Standard attribute retained')).toHaveLength(3);
  });

  it('filters action dropdowns strictly by column type', () => {
    // 1. Coordinates: Only GENERALIZE_SPATIAL, DROP_COLUMN, KEEP
    const coordPii = { name: 'latitude', column: 'latitude', category: 'coordinates', classification: 'Geographic Latitude (GPS)' };
    const coordActions = getAllowedActionsForColumn(coordPii).map(a => a.value);
    expect(coordActions).toEqual(['GENERALIZE_SPATIAL', 'DROP_COLUMN', 'KEEP']);
    expect(coordActions).not.toContain('PSEUDONYMIZE_HMAC');
    expect(coordActions).not.toContain('TIME_BUCKET');
    expect(coordActions).not.toContain('REDACT');

    // 2. Datetime: Only TIME_BUCKET, DROP_COLUMN, KEEP
    const timePii = { name: 'timestamp', column: 'timestamp', category: 'datetime', classification: 'Traffic Telemetry Timestamp' };
    const timeActions = getAllowedActionsForColumn(timePii).map(a => a.value);
    expect(timeActions).toEqual(['TIME_BUCKET', 'DROP_COLUMN', 'KEEP']);
    expect(timeActions).not.toContain('GENERALIZE_SPATIAL');
    expect(timeActions).not.toContain('PSEUDONYMIZE_HMAC');

    // 3. Free Text: Only REDACT, DROP_COLUMN, KEEP
    const notesPii = { name: 'notes', column: 'notes', category: 'free_text_pii', classification: 'Free-Text with Embedded PII' };
    const notesActions = getAllowedActionsForColumn(notesPii).map(a => a.value);
    expect(notesActions).toEqual(['REDACT', 'DROP_COLUMN', 'KEEP']);

    // 4. Identifiers: Only PSEUDONYMIZE_HMAC, DROP_COLUMN, KEEP
    const platePii = { name: 'vehicle_plate', column: 'vehicle_plate', category: 'plate_number', classification: 'License Plate' };
    const plateActions = getAllowedActionsForColumn(platePii).map(a => a.value);
    expect(plateActions).toEqual(['PSEUDONYMIZE_HMAC', 'DROP_COLUMN', 'KEEP']);

    const organizationActions = getAllowedActionsForColumn({
      name: 'Vendor Name',
      category: 'organization_name',
      classification: 'Organization / Vendor Name'
    }).map(a => a.value);
    expect(organizationActions).toEqual(['PSEUDONYMIZE_HMAC', 'DROP_COLUMN', 'KEEP']);

    const contactPersonActions = getAllowedActionsForColumn({
      name: 'Contact Person',
      category: 'driver_name',
      classification: 'Contact Person Name'
    }).map(a => a.value);
    expect(contactPersonActions).toEqual(['DROP_COLUMN', 'REDACT', 'KEEP']);

    // 5. High-risk direct PII (SSN, credit card, DOB): Can be DROP_COLUMN, REDACT, PSEUDONYMIZE_HMAC, KEEP
    const ssnPii = { name: 'driver_ssn', column: 'driver_ssn', category: 'ssn', classification: 'National ID / SSN' };
    const ssnActions = getAllowedActionsForColumn(ssnPii).map(a => a.value);
    expect(ssnActions).toEqual(['DROP_COLUMN', 'REDACT', 'PSEUDONYMIZE_HMAC', 'KEEP']);

    const standardActions = getAllowedActionsForColumn({
      name: 'speed_mph',
      category: 'data_attribute',
      classification: 'Numeric Attribute'
    }).map(a => a.value);
    expect(standardActions).toEqual(['KEEP', 'DROP_COLUMN', 'PSEUDONYMIZE_HMAC']);

    const roadActions = getAllowedActionsForColumn({
      name: 'road_segment',
      category: 'location_identifier',
      classification: 'Road / Route Location'
    }).map(a => a.value);
    expect(roadActions).toEqual(['REDACT', 'PSEUDONYMIZE_HMAC', 'DROP_COLUMN', 'KEEP']);
  });

  it('generates masked samples dynamically from the real first non-null value', () => {
    const coordPii = {
      name: 'latitude',
      column: 'latitude',
      category: 'coordinates',
      first_non_null_value: '34.052235',
      sample_masked: '34.05 (~1.1 km)'
    };

    // When GENERALIZE_SPATIAL
    expect(getMaskedSampleDisplay(coordPii, 'GENERALIZE_SPATIAL', { gpsPrecision: 2 })).toBe('34.05 (~1.1 km)');
    expect(getMaskedSampleDisplay(coordPii, 'GENERALIZE_SPATIAL', { gpsPrecision: 1 })).toBe('34.1 (~1.1 km)');

    // When user changes to DROP_COLUMN
    expect(getMaskedSampleDisplay(coordPii, 'DROP_COLUMN', {})).toBe('[COLUMN_REMOVED]');

    // When user changes to KEEP
    expect(getMaskedSampleDisplay(coordPii, 'KEEP', {})).toBe('34.052235');

    // For ID
    const idPii = {
      name: 'record_id',
      column: 'record_id',
      category: 'identifier',
      first_non_null_value: 'TRF-9468',
      sample_masked: 'ANON_a1b2c3d4e5f6'
    };
    expect(getMaskedSampleDisplay(idPii, 'PSEUDONYMIZE_HMAC', {})).toBe('ANON_a1b2c3d4e5f6');
    expect(getMaskedSampleDisplay(idPii, 'DROP_COLUMN', {})).toBe('[COLUMN_REMOVED]');
    expect(getMaskedSampleDisplay(idPii, 'KEEP', {})).toBe('TRF-9468');
  });

  it('enforces privacy-by-design and pseudonymous wording without false GDPR-compliant claims', () => {
    const idActions = getAllowedActionsForColumn({ category: 'identifier' });
    const hmacOpt = idActions.find(a => a.value === 'PSEUDONYMIZE_HMAC');
    expect(hmacOpt.label).toContain('Pseudonymize');
    expect(hmacOpt.label).not.toContain('Anonymize');
  });
});

describe('Risk Reduction & Sharing Option Controls (User Requirements 1-8)', () => {
  beforeEach(() => {
    useWorkflowStore.getState().resetWorkflow();
    useWorkflowStore.getState().setProfileData({
      row_count: 500,
      total_rows: 500,
      duplicate_count: 20,
      pii_columns: [
        { column: 'vehicle_plate', name: 'vehicle_plate', category: 'plate_number', classification: 'License Plate' },
        { column: 'latitude', name: 'latitude', category: 'coordinates', classification: 'Geographic Latitude (GPS)' }
      ]
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('buildJobPayloadConfig sends kThreshold ONLY for suppress and aggregate, omitting it for none', () => {
    // Mode 'none': kThreshold must NOT be included
    const nonePayload = buildJobPayloadConfig({ riskReductionMode: 'none', kThreshold: 3 });
    expect(nonePayload.riskReductionMode).toBe('none');
    expect(nonePayload.kThreshold).toBeUndefined();

    // Mode 'suppress': kThreshold must be sent
    const suppressPayload = buildJobPayloadConfig({ riskReductionMode: 'suppress', kThreshold: 4 });
    expect(suppressPayload.riskReductionMode).toBe('suppress');
    expect(suppressPayload.kThreshold).toBe(4);

    // Mode 'aggregate': kThreshold must be sent
    const aggPayload = buildJobPayloadConfig({ riskReductionMode: 'aggregate', kThreshold: 5 });
    expect(aggPayload.riskReductionMode).toBe('aggregate');
    expect(aggPayload.kThreshold).toBe(5);
  });

  it('renders three-option card selector titled "How will this data be shared?" and maps to correct backend values', () => {
    render(
      <ToastProvider>
        <Step3Configure />
      </ToastProvider>
    );

    // 1. Title, helper and tooltip
    expect(screen.getByText('How will this data be shared?')).toBeDefined();
    expect(screen.getByTestId('live-preview-estimate')).toBeDefined();

    // Check radiogroup accessibility
    const radioGroup = screen.getByRole('radiogroup', { name: /How will this data be shared\?/i });
    expect(radioGroup).toBeDefined();

    // 2. Select "Share with a partner" (maps to suppress)
    const partnerOption = screen.getByRole('radio', { name: /Share with a partner/i });
    fireEvent.click(partnerOption);

    expect(useWorkflowStore.getState().customConfig.riskReductionMode).toBe('suppress');
    expect(useWorkflowStore.getState().customConfig.suppressLowK).toBe(true);
    expect(partnerOption.getAttribute('aria-checked')).toBe('true');

    // Amber note should NOT be visible
    expect(screen.queryByTestId('internal-use-note')).toBeNull();

    // Payload includes kThreshold
    const suppressConfig = buildJobPayloadConfig(useWorkflowStore.getState().customConfig);
    expect(suppressConfig.riskReductionMode).toBe('suppress');
    expect(suppressConfig.kThreshold).toBe(3);

    // 3. Select "Publish aggregates" (maps to aggregate)
    const publicOption = screen.getByRole('radio', { name: /Publish aggregates/i });
    fireEvent.click(publicOption);

    expect(useWorkflowStore.getState().customConfig.riskReductionMode).toBe('aggregate');
    expect(useWorkflowStore.getState().customConfig.suppressLowK).toBe(false);
    expect(publicOption.getAttribute('aria-checked')).toBe('true');

    // Payload includes kThreshold
    const aggConfig = buildJobPayloadConfig(useWorkflowStore.getState().customConfig);
    expect(aggConfig.riskReductionMode).toBe('aggregate');
    expect(aggConfig.kThreshold).toBe(3);

    // 4. Select "Internal use only" (maps to none)
    const internalOption = screen.getByRole('radio', { name: /Internal use only/i });
    fireEvent.click(internalOption);

    expect(useWorkflowStore.getState().customConfig.riskReductionMode).toBe('none');
    expect(useWorkflowStore.getState().customConfig.suppressLowK).toBe(false);
    expect(internalOption.getAttribute('aria-checked')).toBe('true');

    // Amber note MUST be displayed for "Internal use only"
    const amberNote = screen.getByTestId('internal-use-note');
    expect(amberNote).toBeDefined();
    expect(amberNote.textContent).toContain('Row-level data can still identify some trips. Do not share this file.');

    // Payload must NOT include kThreshold when none
    const noneConfig = buildJobPayloadConfig(useWorkflowStore.getState().customConfig);
    expect(noneConfig.riskReductionMode).toBe('none');
    expect(noneConfig.kThreshold).toBeUndefined();
  });

  it('manages collapsed Advanced K group size stepper and bounds between 2 and 10', () => {
    render(
      <ToastProvider>
        <Step3Configure />
      </ToastProvider>
    );

    // Advanced is collapsed initially
    const advancedToggle = screen.getByRole('button', { name: /Advanced/i });
    expect(advancedToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Minimum group size')).toBeNull();

    // Expand Advanced
    fireEvent.click(advancedToggle);
    expect(advancedToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Minimum group size')).toBeDefined();
    expect(screen.getByText(/Each row must look like at least this many others/i)).toBeDefined();

    // Default group size is 3
    const stepperVal = screen.getByTestId('group-size-value');
    expect(stepperVal.textContent).toBe('3');

    // Stepper + (increment)
    const incBtn = screen.getByLabelText('Increase minimum group size');
    fireEvent.click(incBtn);
    expect(stepperVal.textContent).toBe('4');
    expect(useWorkflowStore.getState().customConfig.kThreshold).toBe(4);

    // Stepper - (decrement) back to 3, then 2
    const decBtn = screen.getByLabelText('Decrease minimum group size');
    fireEvent.click(decBtn);
    expect(stepperVal.textContent).toBe('3');

    fireEvent.click(decBtn);
    expect(stepperVal.textContent).toBe('2');
    expect(useWorkflowStore.getState().customConfig.kThreshold).toBe(2);

    // Disabled at lower bound 2
    expect(decBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(decBtn);
    expect(stepperVal.textContent).toBe('2');
  });

  it('renders measured privacy and output preview guidance', () => {
    render(
      <ToastProvider>
        <Step3Configure />
      </ToastProvider>
    );

    const estimate = screen.getByTestId('live-preview-estimate');
    expect(estimate).toBeDefined();
    expect(estimate.textContent).toContain('Risk and output counts are measured from the processed data, not estimated from a heuristic.');
    expect(estimate.textContent).toContain('UNKNOWN');

    // Until a job runs, release counts are not measured.
    const internalOption = screen.getByRole('radio', { name: /Internal use only/i });
    fireEvent.click(internalOption);
    expect(estimate.textContent).toContain('UNKNOWN');

    // The app does not fabricate suppression counts.
    const partnerOption = screen.getByRole('radio', { name: /Share with a partner/i });
    fireEvent.click(partnerOption);
    expect(estimate.textContent).toContain('UNKNOWN');

    // Aggregate outputs are counted after the selected data is processed.
    const publicOption = screen.getByRole('radio', { name: /Publish aggregates/i });
    fireEvent.click(publicOption);
    expect(estimate.textContent).toContain('UNKNOWN');
  });

  it('provides an accessible generic quasi-identifier tooltip', () => {
    render(
      <ToastProvider>
        <Step3Configure />
      </ToastProvider>
    );

    const tooltipBtn = screen.getByLabelText(/Info: sharing-example/i);
    expect(tooltipBtn).toBeDefined();

    // Hover or focus triggers tooltip
    fireEvent.mouseEnter(tooltipBtn);
    const tooltipContent = screen.getByRole('tooltip');
    expect(tooltipContent).toBeDefined();
    expect(tooltipContent.textContent).toContain('selected quasi-identifiers occur in a small group.');
  });
});

describe('Truthful Copy & Banned Phrases Audit', () => {
  it('asserts 0 occurrences of banned marketing phrases in client source files', () => {
    const bannedPhrases = [
      'Compliance Verified',
      'Zero raw',
      'Quantum',
      '100% Pass',
      'guarantee'
    ];

    const clientSrcDir = path.resolve(__dirname, '..');
    const sourceFiles = [];

    function findFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
          findFiles(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
          sourceFiles.push(fullPath);
        }
      }
    }

    findFiles(clientSrcDir);
    expect(sourceFiles.length).toBeGreaterThan(5);

    const violations = [];
    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const phrase of bannedPhrases) {
        const regex = new RegExp(`\\b${phrase}\\b`, 'i');
        if (regex.test(content)) {
          violations.push({ file: path.relative(clientSrcDir, filePath), phrase });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
