/**
 * Server-Sent Events (SSE) Stream Manager for Real-Time Pipeline Progress & Logs
 */
class JobStreamService {
  constructor() {
    this.subscribers = new Map(); // jobId -> Set of Express Response objects
    this.eventHistory = new Map(); // jobId -> Array of { event, data, timestamp }
  }

  createSession(jobId) {
    if (!this.eventHistory.has(jobId)) {
      this.eventHistory.set(jobId, []);
    }
  }

  subscribe(jobId, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    this.subscribers.get(jobId).add(res);

    // Immediately send replay of past events for this job
    const history = this.eventHistory.get(jobId) || [];
    for (const item of history) {
      res.write(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`);
    }

    // Keep-alive heartbeat every 15s
    const heartbeat = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    reqCloseHandler:
    res.on('close', () => {
      clearInterval(heartbeat);
      const set = this.subscribers.get(jobId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.subscribers.delete(jobId);
        }
      }
    });
  }

  emit(jobId, event, data) {
    const payload = { event, data, timestamp: new Date().toISOString() };
    
    // Store in history for replay
    if (!this.eventHistory.has(jobId)) {
      this.eventHistory.set(jobId, []);
    }
    this.eventHistory.get(jobId).push(payload);

    // Broadcast to connected SSE clients
    const set = this.subscribers.get(jobId);
    if (set && set.size > 0) {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of set) {
        try {
          res.write(message);
        } catch (err) {
          console.warn(`[JobStream] Failed to send SSE to client for job ${jobId}:`, err.message);
        }
      }
    }
  }

  cleanup(jobId) {
    // Keep history for 10 minutes then purge
    setTimeout(() => {
      this.eventHistory.delete(jobId);
      this.subscribers.delete(jobId);
    }, 10 * 60 * 1000);
  }
}

export const jobStreamService = new JobStreamService();
