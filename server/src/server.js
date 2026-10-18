import app from './app.js';
import { env } from './config/env.js';
import { db } from './config/db.js';

// Connect to MongoDB
await db.connect();

app.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚦 Traffic Data Processor Server running!`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`⚡ Mode: ${env.NODE_ENV}`);
  console.log(`🍃 Database: ${db.isConnected ? 'MongoDB Connected' : 'In-Memory Fallback'}`);
  console.log(`📁 Uploads dir: ${env.UPLOAD_DIR}`);
  console.log(`===============================================`);
});
