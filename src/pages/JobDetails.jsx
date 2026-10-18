import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Database, AlertCircle } from 'lucide-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import Step5Results from '../components/wizard/Step5Results';
import PageLoader from '../components/PageLoader';
import axios from 'axios';

export default function JobDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const completeJob = useWorkflowStore((s) => s.completeJob);
  const activeJob = useWorkflowStore((s) => s.activeJob);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axios
      .get(`/api/jobs/${id}`)
      .then((res) => {
        if (res.data?.job) {
          completeJob(res.data.job, null);
        } else {
          setError('Job not found');
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || 'Failed to load job');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="py-12 max-w-4xl mx-auto">
        <PageLoader
          variant="card"
          title="Loading Job Verification Details"
          subtitle={`Retrieving cryptographic audit trail and quality battery for job ${id}...`}
          steps={[
            'Fetching job metadata from MongoDB collection...',
            'Reconciling row accounting and quality battery...',
            'Auditing HMAC pseudonymization and GPS boundaries...',
            'Preparing interactive compliance dashboard...'
          ]}
        />
      </div>
    );
  }

  if (error || !activeJob) {
    return (
      <div className="p-10 rounded-2xl bg-theme-card border border-theme-border text-center space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-theme-text">Job Not Found</h3>
        <p className="text-xs text-theme-muted">
          The requested job <span className="font-mono text-theme-text font-semibold">{id}</span> does not exist or has been deleted from MongoDB.
        </p>
        <Link
          to="/jobs"
          className="inline-block px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold"
        >
          Return to Jobs Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-2">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-theme-dim hover:text-cyan-400 font-mono transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Jobs Directory</span>
        </Link>
      </div>

      <Step5Results />
    </div>
  );
}
