import React, { useState, useRef } from 'react';
import { trafficApi } from '../api/client';
import { useToast } from './Toast';

export default function FileUpload({ onJobCompleted, onUploadStart }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMsg('');
    const validExtensions = ['.csv', '.json'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setErrorMsg('Invalid file format. Please upload a .CSV or .JSON dataset.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 50MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setErrorMsg('');
      if (onUploadStart) onUploadStart();

      const response = await trafficApi.uploadFile(selectedFile, (pct) => {
        setProgress(pct);
      });

      if (response.success && onJobCompleted) {
        showToast('Dataset anonymized & validated successfully!');
        onJobCompleted(response.job, response.before_after_sample);
        setSelectedFile(null);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'File processing failed';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      <h3 style={{ marginBottom: '0.4rem', fontSize: '1.15rem' }}>📤 Ingest Traffic Dataset</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Upload raw vehicle sensor logs, GPS coordinates, or transit CSV/JSON records.
      </p>

      <div
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
        <p style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>
          {selectedFile ? selectedFile.name : 'Click or drag traffic dataset here'}
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          Supports .CSV, .JSON (up to 50MB) — Raw files deleted immediately post-processing
        </p>
      </div>

      {errorMsg && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#fb7185',
            fontSize: '0.85rem'
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {uploading && (
        <div style={{ marginTop: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              marginBottom: '0.35rem',
              color: 'var(--text-muted)'
            }}
          >
            <span>Processing pipeline executing...</span>
            <span>{progress}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '999px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        {selectedFile && !uploading && (
          <button
            className="btn-secondary"
            onClick={() => {
              setSelectedFile(null);
              setErrorMsg('');
            }}
          >
            Clear
          </button>
        )}
        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
        >
          {uploading ? 'Processing Data...' : 'Run Privacy Pipeline'}
        </button>
      </div>
    </div>
  );
}
