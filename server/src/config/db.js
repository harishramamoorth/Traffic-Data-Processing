import mongoose from 'mongoose';
import { env } from './env.js';
import { JobModel } from '../models/Job.js';
import { RecordModel } from '../models/Record.js';

class Database {
  constructor() {
    this.inMemoryJobs = new Map();
    this.inMemoryRecords = new Map();
    this.isConnected = false;
  }

  async connect() {
    try {
      if (mongoose.connection.readyState === 1) {
        this.isConnected = true;
        return;
      }
      console.log(`Connecting to MongoDB at: ${env.MONGODB_URI}...`);
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      this.isConnected = true;
      console.log(`🍃 Connected to MongoDB successfully! Database: ${mongoose.connection.name}`);
    } catch (err) {
      this.isConnected = false;
      console.warn(`⚠️ MongoDB connection failed (${err.message}). Operating in in-memory fallback mode.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Job Operations
  // ---------------------------------------------------------------------------
  async saveJob(jobData) {
    this.inMemoryJobs.set(jobData.id, jobData);
    if (this.isConnected) {
      try {
        await JobModel.findOneAndUpdate(
          { id: jobData.id },
          jobData,
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err) {
        console.error('Error persisting job to MongoDB:', err.message);
      }
    }
    return jobData;
  }

  async getJob(id) {
    if (this.isConnected) {
      try {
        const found = await JobModel.findOne({ id }).lean();
        if (found) return found;
      } catch (err) {
        console.error('Error fetching job from MongoDB:', err.message);
      }
    }
    return this.inMemoryJobs.get(id) || null;
  }

  async getJobsPaginated({ page = 1, limit = 10, search = '', status = 'ALL' }) {
    const skip = (page - 1) * limit;

    if (this.isConnected) {
      try {
        const query = {};
        if (status && status !== 'ALL') {
          query.status = status;
        }
        if (search) {
          query.originalFilename = { $regex: search, $options: 'i' };
        }

        const [jobs, total] = await Promise.all([
          JobModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          JobModel.countDocuments(query)
        ]);

        return {
          jobs,
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1
        };
      } catch (err) {
        console.error('Error reading paginated jobs from MongoDB:', err.message);
      }
    }

    // In-memory fallback
    let all = Array.from(this.inMemoryJobs.values());
    if (status && status !== 'ALL') {
      all = all.filter(j => j.status === status);
    }
    if (search) {
      const s = search.toLowerCase();
      all = all.filter(j => j.originalFilename && j.originalFilename.toLowerCase().includes(s));
    }
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = all.length;
    const paginated = all.slice(skip, skip + limit);

    return {
      jobs: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async deleteJob(id) {
    let deleted = false;
    if (this.isConnected) {
      try {
        const [jobRes, recRes] = await Promise.all([
          JobModel.deleteOne({ id }),
          RecordModel.deleteMany({ jobId: id })
        ]);
        deleted = jobRes.deletedCount > 0;
      } catch (err) {
        console.error('Error deleting job in MongoDB:', err.message);
      }
    }
    const memDeleted = this.inMemoryJobs.delete(id);
    this.inMemoryRecords.delete(id);
    return deleted || memDeleted;
  }

  // ---------------------------------------------------------------------------
  // Record Operations (Anonymized Data Only)
  // ---------------------------------------------------------------------------
  async saveRecords(jobId, recordsArray) {
    const records = recordsArray || [];

    // Cache in memory
    this.inMemoryRecords.set(jobId, records);

    if (this.isConnected) {
      try {
        const docs = records.map((r, i) => ({
          id: `${jobId}_rec_${i}`,
          jobId,
          data: r,
          createdAt: new Date()
        }));
        if (docs.length === 0) {
          await RecordModel.deleteMany({ jobId });
          return;
        }
        await RecordModel.bulkWrite(docs.map(doc => ({
          replaceOne: {
            filter: { id: doc.id },
            replacement: doc,
            upsert: true
          }
        })));
        await RecordModel.deleteMany({
          jobId,
          id: { $nin: docs.map(doc => doc.id) }
        });
      } catch (err) {
        console.error('Error batch inserting records into MongoDB:', err.message);
      }
    }
  }

  async getRecordsPaginated(jobId, { page = 1, limit = 10, sort, order = 'asc', filter }) {
    const skip = (page - 1) * limit;

    if (this.isConnected) {
      try {
        const query = { jobId };
        if (filter) {
          // General regex search on data sub-document
          query.$or = [
            { 'data.record_id': { $regex: filter, $options: 'i' } },
            { 'data.vehicle_plate': { $regex: filter, $options: 'i' } },
            { 'data.road_segment': { $regex: filter, $options: 'i' } }
          ];
        }

        const sortObj = {};
        if (sort) {
          sortObj[`data.${sort}`] = order === 'desc' ? -1 : 1;
        } else {
          sortObj.createdAt = 1;
        }

        const [docs, total] = await Promise.all([
          RecordModel.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
          RecordModel.countDocuments(query)
        ]);

        return {
          records: docs.map(d => d.data),
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1
        };
      } catch (err) {
        console.error('Error reading records from MongoDB:', err.message);
      }
    }

    // In-memory fallback
    const all = this.inMemoryRecords.get(jobId) || [];
    let filtered = [...all];
    if (filter) {
      const f = filter.toLowerCase();
      filtered = filtered.filter(item => JSON.stringify(item).toLowerCase().includes(f));
    }
    if (sort) {
      filtered.sort((a, b) => {
        const valA = a[sort] ?? '';
        const valB = b[sort] ?? '';
        if (valA < valB) return order === 'desc' ? 1 : -1;
        if (valA > valB) return order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      records: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async getAllRecordsForJob(jobId) {
    const cachedRecords = this.inMemoryRecords.get(jobId);
    if (cachedRecords) return cachedRecords;

    if (this.isConnected) {
      try {
        const docs = await RecordModel.find({ jobId }).sort({ createdAt: 1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map(d => d.data);
        }
      } catch (err) {
        console.error('Error reading all records from MongoDB:', err.message);
      }
    }
    return this.inMemoryRecords.get(jobId) || [];
  }
}

export const db = new Database();
