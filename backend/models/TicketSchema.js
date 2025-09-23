import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  ticketCode: { type: String, required: true, unique: true, trim: true },
  subject: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },

  status: { type: String, enum: ['todo', 'inprogress', 'completed'], default: 'todo', index: true },
  storyPoints: { type: Number, min: 1, max: 13, default: 3 },

 // detectedIntent: { type: String, trim: true },
  Tags: { type: [String], default: [] },

  department: { type: String, required: true, trim: true }, // department name
  requiredRole: { type: String, required: true, trim: true }, // role name string

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

  assigneeName: { type: String, trim: true },
  assigneeDept: { type: String, trim: true },

  dateCreated: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date },
  completedAt: { type: Date },

  assignmentReason: { type: String, trim: true } // "role-match" | "manager-fallback" | "load-balance"
}, { timestamps: true });

TicketSchema.index({ department: 1, requiredRole: 1, status: 1 });
TicketSchema.index({ assignee: 1, status: 1 });

export default mongoose.model('Ticket', TicketSchema);
