const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Resolve backend .env
const backendEnvPath = path.resolve(__dirname, '../../my-notes-and-tasks-backend/.env');
dotenv.config({ path: backendEnvPath });
// Load root .env as well
dotenv.config();

// Fallback for encryption secret
if (!process.env.DATA_ENCRYPTION_SECRET) {
  console.warn('⚠️ DATA_ENCRYPTION_SECRET not set; falling back to test secret');
  process.env.DATA_ENCRYPTION_SECRET = 'test_secret';
}

module.exports = async function globalSetup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }

  console.log('🔗 Connecting to MongoDB at:', uri);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  });
  console.log('✅ MongoDB connected');

  const db = mongoose.connection.db;
  const usersCol = db.collection('users');
  const plainPassword = 'password123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const emails = ['test@e2e.com', 'admin@e2e.com', 'user@e2e.com'];

  for (const email of emails) {
    const existing = await usersCol.findOne({ email });
    if (!existing) {
      await usersCol.insertOne({
        email,
        password: hashedPassword,
        role: 'user',
        isVerified: true,
        notesTree: [],
      });
      console.log(`✅ Created & verified ${email}`);
    } else if (!existing.isVerified) {
      await usersCol.updateOne({ email }, { $set: { isVerified: true } });
      console.log(`🔄 Verified existing ${email}`);
    } else {
      console.log(`ℹ️  ${email} already exists and verified`);
    }
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB after global setup');
};
