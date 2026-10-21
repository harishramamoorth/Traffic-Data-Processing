import axios from 'axios';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const api = axios.create({
  baseURL: apiBase ? `${apiBase}/api` : '/api',
  timeout: 60000
});

export const getApiUrl = (endpoint) => `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

export const trafficApi = {
  // Upload and process raw traffic dataset
  async uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/jobs/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      }
    });
    return response.data;
  },

  // Fetch paginated list of jobs with search & status filters
  async getJobs({ page = 1, limit = 10, search = '', status = 'ALL' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (search) params.append('search', search);
    if (status && status !== 'ALL') params.append('status', status);

    const response = await api.get(`/jobs?${params.toString()}`);
    return response.data;
  },

  // Fetch specific job details
  async getJobById(jobId) {
    const response = await api.get(`/jobs/${jobId}`);
    return response.data;
  },

  // Fetch paginated anonymized records for a job
  async getJobRecords(jobId, { page = 1, limit = 10, sort, order = 'asc', filter } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (sort) params.append('sort', sort);
    if (order) params.append('order', order);
    if (filter) params.append('filter', filter);

    const response = await api.get(`/jobs/${jobId}/records?${params.toString()}`);
    return response.data;
  },

  // Download cleaned dataset as CSV or JSON
  downloadUrl(jobId, format = 'csv', type = 'row') {
    return getApiUrl(`/api/jobs/${jobId}/download?format=${format}&type=${type}`);
  },

  // Download audit report as Markdown or JSON
  reportUrl(jobId, format = 'markdown') {
    return getApiUrl(`/api/jobs/${jobId}/report?format=${format}`);
  },

  // Delete a job and its records
  async deleteJob(jobId) {
    const response = await api.delete(`/jobs/${jobId}`);
    return response.data;
  },

  // Health check
  async getHealth() {
    const response = await api.get('/health');
    return response.data;
  }
};

export default api;
