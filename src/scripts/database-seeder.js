// Database seeder to create test users for development and testing

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/MyNotesAppDB_Prod'), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding...');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// User model (adjust path as needed)
const User = require('../models/User'); // Adjust this path to your User model

// Test users to seed
const testUsers = [
  {
    email: 'test@e2e.com',
    password: 'password123',
    notesTree: []
  },
  {
    email: 'admin@e2e.com',
    password: 'admin123',
    notesTree: [
      {
        id: 'folder-1',
        type: 'folder',
        label: 'Work Projects',
        children: [
          {
            id: 'note-1',
            type: 'note',
            label: 'Meeting Notes',
            content: '<p>Important meeting notes go here...</p>',
            direction: 'ltr',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'task-1',
            type: 'task',
            label: 'Complete project proposal',
            content: '<p>Details about the project proposal task</p>',
            completed: false,
            direction: 'ltr',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  },
  {
    email: 'user@e2e.com',
    password: 'user123',
    notesTree: []
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');
    
    // Clear existing test users (optional - be careful in production!)
    if (process.env.NODE_ENV !== 'production') {
      await User.deleteMany({ 
        email: { $in: testUsers.map(user => user.email) } 
      });
      console.log('Cleared existing test users');
    }
    
    // Create test users
    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      
      if (!existingUser) {
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create user
        const user = new User({
          email: userData.email,
          password: hashedPassword,
          notesTree: userData.notesTree || []
        });
        
        await user.save();
        console.log(`✓ Created user: ${userData.email}`);
      } else {
        console.log(`- User already exists: ${userData.email}`);
      }
    }
    
    console.log('\n✅ Database seeding completed!');
    console.log('\nTest accounts created:');
    testUsers.forEach(user => {
      console.log(`📧 Email: ${user.email} | 🔑 Password: ${user.password}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeder if called directly
if (require.main === module) {
  connectDB().then(() => {
    seedDatabase();
  });
}

module.exports = { seedDatabase, connectDB, testUsers };