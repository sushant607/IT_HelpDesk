const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message:{type:String},
  createdAt: { type: Date, default: Date.now }
});

const AttachmentSchema=
 new mongoose.Schema({
  
  filename:{type:String},
  url: { type: String}
});


const TicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: {type:String},
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'closed','resolved'], 
    default: 'open' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high','urgent'], 
    required: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // NEW: department assignment
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

  comments: [CommentSchema],
  attachments: [AttachmentSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  storyPoints: {type: Number, default: 1}
});

module.exports = mongoose.model('Ticket', TicketSchema);
