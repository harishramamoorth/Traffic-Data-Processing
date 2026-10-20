import app from './app.js';
import { env } from './config/env.js';
import { db } from './config/db.js';

const server = app.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚦 Traffic Data Processor Server running!`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`⚡ Mode: ${env.NODE_ENV}`);
  console.log(`📁 Uploads dir: ${env.UPLOAD_DIR}`);
  console.log(`===============================================`);
});

// Connect to MongoDB asynchronously (in-memory mode is ready immediately)
db.connect().then(() => {
  console.log(`🍃 Database mode: ${db.isConnected ? 'MongoDB Connected' : 'In-Memory Fallback'}`);
});
