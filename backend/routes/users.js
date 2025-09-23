const mongoose = require('mongoose');

const departments = {
  support: ['Helpdesk', 'Customer Care', 'Field Support'],
  software: ['Backend Team', 'Frontend Team', 'QA Team'],
  network: ['Routing & Switching', 'Security Team', 'Wireless Team'],
  infrastructure: ['Cloud Ops', 'Data Center', 'IT Support'],
  hardware: ['Assembly Team', 'Maintenance Team', 'R&D Hardware'],
  database: ['DB Admins', 'Data Engineering', 'Backup & Recovery']
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['employee', 'manager', 'admin'], 
    default: 'employee' 
  },
  department: { 
    type: String, 
    enum: Object.keys(departments),
    required: true
  },
  team: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

// Custom validation: team must belong to department
UserSchema.pre('save', function(next) {
  const validTeams = departments[this.department];
  if (!validTeams || !validTeams.includes(this.team)) {
    return next(new Error(`Invalid team '${this.team}' for department '${this.department}'`));
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);
