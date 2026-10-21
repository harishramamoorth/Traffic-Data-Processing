# Production Dockerfile for Traffic Data Processor Backend (Node 20 + Python 3.12)
FROM node:20-slim

# Install system dependencies & Python 3 runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create virtual environment and install Python packages
COPY processor/requirements.txt ./processor/
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/.venv/bin/pip install --no-cache-dir -r ./processor/requirements.txt

# Install Node.js API server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy application source code
COPY server/ ./server/
COPY processor/ ./processor/
COPY docs/ ./docs/
COPY package.json ./

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHON_PATH=/app/.venv/bin/python

EXPOSE 5000

CMD ["npm", "--prefix", "server", "start"]
