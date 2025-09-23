const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['employee', 'manager', 'admin'], 
    default: 'employee',
    required: true
  },
  department: { 
    type: String, 
    enum: [
      'support team A',
      'software team',
      'network team',
      'infrastructure team',
      'hardware team',
      'database team'
    ],
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
