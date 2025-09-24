const router = require('express').Router();
const mongoose = require('mongoose');
const authenticate = require('../middleware/auth');
const {
  requireRole,
  canCreateFor,
  canUpdate,
  canDelete,
  canMarkComplete,
  canAssign,
  canCreateTicket
} = require('../middleware/authorizeAction');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Utility: Get number of tickets assigned to a user
async function countTicketsAssignedToUser(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
  return await Ticket.countDocuments({ assignedTo: userId });
}

// GET /api/tickets/recommend-assignees?department=
router.get('/recommend-assignees', authenticate, async (req, res) => {
  try {
    const { department } = req.query || {};

    // Get all users in the same department
    const users = await User.find({ department: department.replace('+', ' ') }).select('name email role department');

    // For each user, count assigned tickets
    const userLoads = await Promise.all(users.map(async (user) => {
      const count = await countTicketsAssignedToUser(user._id);
      return { user, assignedCount: count };
    }));

    // Sort by assignedCount ascending
    userLoads.sort((a, b) => a.assignedCount - b.assignedCount);

    // Return top 3 users
    const recommendations = userLoads.slice(0, 3).map(({ user, assignedCount }) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      assignedTicketCount: assignedCount
    }));

    return res.json({ recommendations });
  } catch (e) {
    console.error('GET /tickets/recommend-assignees error:', e);
    return res.status(500).json({ msg: 'recommend_error' });
  }
});

// GET /api/tickets?scope=me|team&status=&priority=&keywords=
router.get('/', authenticate, async (req, res) => {
  try {

    const { scope = 'me', status, priority, keywords } = req.query || {};
    const filter = {};

    if (scope === 'me') {
      if (req.user.role === 'employee') {
        filter.assignedTo = new mongoose.Types.ObjectId(req.user.id);
      } else 
        filter.createdBy = new mongoose.Types.ObjectId(req.user.id);
    } else if (scope === 'team') {
      if (req.user.role === 'employee') {
        return res.status(403).json({ msg: 'Forbidden: Employees cannot access team tickets' });
      }
      if (!req.user.department) {
        return res.status(400).json({ msg: 'Missing user department' });
      }
      filter.createdBy = new mongoose.Types.ObjectId(req.user.id);
      filter.department = req.user.department;
    } else {
      return res.status(400).json({ msg: 'Invalid scope. Use "me" or "team"' });
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    let tickets = await Ticket.find(filter)
      .populate('createdBy', 'name email role department')
      .populate('assignedTo', 'name email role department')
      .populate('comments.author','name')
   .sort({ createdAt: -1 });
console.log(tickets[2].comments);
    if(keywords){
      const keywordArray = keywords.split('+');
      tickets = tickets.filter((ticket) => {
        for(const keyword of keywordArray) {
          if(ticket.description?.includes(keyword) || ticket.title.includes(keyword)){
            return true;
          }
        }
        return false;
      })
    }
    return res.json({ tickets });
  } catch (e) {
    console.error('GET /tickets error:', e);
    return res.status(500).json({ msg: 'fetch_error' });
  }
});

// POST /api/tickets
router.post('/', authenticate, async (req, res) => {
    try {
      const { title, description = '', priority, createdForUserId, assignedTo } = req.body || {};
      const role = req.user.role;
  
      // Basic input checks
      if (!title || !priority) {
        return res.status(400).json({ msg: 'title and priority required' });
      }
      // Target user (defaults to self)
      const targetUserId = createdForUserId || req.user.id;
  
      // Determine final assignee per role policy
      let finalAssignedTo;
      if (role === 'employee') {
        // Employees cannot select assignee; force to self
        finalAssignedTo = req.user.id;
      } else {
        // Admin/other privileged roles must provide assignedTo
        if (!assignedTo) {
          return res.status(400).json({ msg: 'assignedTo is required for this role' });
        }
        finalAssignedTo = assignedTo;
      }
  
      // Authorization check against policy (server-side)
      const { allowed, reason } = await canCreateTicket(req, targetUserId, finalAssignedTo);
      if (!allowed) {
        return res.status(403).json({ msg: reason });
      }
  
      // Validate target user and get department
      const targetUser = await User.findById(targetUserId).select('department');
      if (!targetUser) {
        return res.status(400).json({ msg: 'target user not found' });
      }
      if (!targetUser.department) {
        return res.status(400).json({ msg: 'target user missing department' });
      }
  
      // Optional: ensure assignee exists
      const assigneeExists = await User.exists({ _id: finalAssignedTo });
      if (!assigneeExists) {
        return res.status(400).json({ msg: 'assignee not found' });
      }
      // Create ticket (Model.create triggers save middleware)
      const doc = await Ticket.create({
        title,
        description,
        priority,
        createdBy: targetUserId, // storing "created for" per existing field naming
        assignedTo: finalAssignedTo,
        department: targetUser.department,
        status: 'open',
      });
      console.log(doc)
      return res.status(201).json({
        ticket_id: doc._id,
        message: 'Ticket created and assigned successfully',
      });
    } catch (e) {
      console.error('POST /tickets error:', e);
      return res.status(500).json({ msg: 'create_error' });
    }
  });
    
// PATCH /api/tickets/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const patch = { ...(req.body || {}) };

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ msg: 'not_found' });

    const allowed = await canUpdate(req, ticket);
    if (!allowed) return res.status(403).json({ msg: 'forbidden' });

    // Employees cannot change department/creator
    if (req.user.role === 'employee') {
      delete patch.department;
      delete patch.createdBy;
    }

    // Managers/Admin cannot move ticket across departments
    if ((req.user.role === 'manager' || req.user.role === 'admin') && patch.department && patch.department !== ticket.department) {
      return res.status(403).json({ msg: 'cannot move ticket across departments' });
    }

    ticket.set({ ...patch, updatedAt: new Date() });
    await ticket.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /tickets error:', e);
    return res.status(500).json({ msg: 'update_error' });
  }
});

// DELETE /api/tickets/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ msg: 'not_found' });

    const allowed = await canDelete(req, ticket);
    if (!allowed) return res.status(403).json({ msg: 'forbidden' });

    await Ticket.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /tickets error:', e);
    return res.status(500).json({ msg: 'delete_error' });
  }
});

// POST /api/tickets/:id/resolve
router.post('/:id/resolve', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ msg: 'not_found' });

    const allowed = await canMarkComplete(req, ticket);
    if (!allowed) return res.status(403).json({ msg: 'forbidden' });

    ticket.status = 'resolved';
    ticket.updatedAt = new Date();
    await ticket.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /tickets/:id/resolve error:', e);
    return res.status(500).json({ msg: 'resolve_error' });
  }
});

// GET /api/tickets/:id — fetch a single ticket by id with RBAC
router.get('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'invalid_id' });
      }
  
      const ticket = await Ticket.findById(id)
        .populate('createdBy', 'name email role department')
        .populate('assignedTo', 'name email role department')
        .populate(  "comments.author", "name");

  console.log(ticket.comments);

      if (!ticket) {
        return res.status(404).json({ msg: 'not_found' });
      }
  
      const isCreator = ticket.createdBy && ticket.createdBy._id?.toString() === req.user.id;
      const isAssignee = ticket.assignedTo && ticket.assignedTo._id?.toString() === req.user.id;
      const sameDept = ticket.department === req.user.department;
  
      // Employees: can view if creator or assignee only
      if (req.user.role === 'employee') {
        if (isCreator || isAssignee) {
          return res.json({ ticket });
        }
        return res.status(403).json({ msg: 'forbidden' });
      }
  
      // Managers/Admins: must be in same department as the ticket
      if (req.user.role === 'manager' || req.user.role === 'admin') {
        if (sameDept || isCreator || isAssignee) {
          return res.json({ ticket });
        }
        return res.status(403).json({ msg: 'cross-department access forbidden' });
      }
  
      // Default deny
      return res.status(403).json({ msg: 'forbidden' });
    } catch (e) {
      console.error('GET /tickets/:id error:', e);
      return res.status(500).json({ msg: 'fetch_error' });
    }
  });
  
// PATCH /api/tickets/:id/assign — assign or unassign a ticket with RBAC
router.patch('/:id/assign', authenticate, requireRole('manager', 'admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedTo = null } = req.body || {};
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: 'invalid_id' });
      }
  
      const ticket = await Ticket.findById(id);
      if (!ticket) return res.status(404).json({ msg: 'not_found' });
  
      // If provided, validate assignee user
      let assigneeUser = null;
      if (assignedTo) {
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
          return res.status(400).json({ msg: 'invalid_assignee_id' });
        }
        assigneeUser = await User.findById(assignedTo).select('department role');
        if (!assigneeUser) return res.status(400).json({ msg: 'assignee_not_found' });
      }
  
      // Enforce assignment policy
      const ok = await canAssign(req, ticket, assigneeUser);
      if (!ok) return res.status(403).json({ msg: 'forbidden' });
  
      // Idempotent: allow unassign when assignedTo is null
      ticket.assignedTo = assignedTo || null;
      ticket.updatedAt = new Date();
      await ticket.save();
  
      return res.json({ ok: true });
    } catch (e) {
      console.error('PATCH /tickets/:id/assign error:', e);
      return res.status(500).json({ msg: 'assign_error' });
    }
  });

module.exports = router;