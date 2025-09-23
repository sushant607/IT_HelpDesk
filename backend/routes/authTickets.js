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
} = require('../middleware/authorizeAction');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// GET /api/tickets?scope=me|team&status=&priority=
router.get('/', authenticate, async (req, res) => {
  try {
    const { scope = 'me', status, priority } = req.query || {};
    const filter = {};

    if (scope === 'me') {
      filter.createdBy = new mongoose.Types.ObjectId(req.user.id);
    } else if (scope === 'team') {
      if (req.user.role === 'employee') {
        return res.status(403).json({ msg: 'Forbidden: Employees cannot access team tickets' });
      }
      if (!req.user.department) {
        return res.status(400).json({ msg: 'Missing user department' });
      }
      filter.department = req.user.department;
    } else {
      return res.status(400).json({ msg: 'Invalid scope. Use "me" or "team"' });
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'name email role department')
      .populate('assignedTo', 'name email role department')
      .sort({ createdAt: -1 });

    return res.json({ tickets });
  } catch (e) {
    console.error('GET /tickets error:', e);
    return res.status(500).json({ msg: 'fetch_error' });
  }
});

// POST /api/tickets
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description = '', priority, assignedTo = null, createdForUserId } = req.body || {};
    if (!title || !priority) {
      return res.status(400).json({ msg: 'title and priority required' });
    }

    // Determine who the ticket is created for
    const targetUserId = createdForUserId || req.user.id;

    // Permission check (employees can only create for self; managers/admin may create for others per policy)
    if (!canCreateFor(req, targetUserId)) {
      return res.status(403).json({ msg: 'not allowed to create for others' });
    }

    // Resolve target user's department
    const targetUser = await User.findById(targetUserId).select('department role');
    if (!targetUser) return res.status(400).json({ msg: 'target user not found' });

    // Compute ticket department based on role policy
    const ticketDept = req.user.role === 'employee' ? targetUser.department : req.user.department;
    if (!ticketDept) return res.status(400).json({ msg: 'missing department context' });

    // Managers/Admin cannot create across departments
    if ((req.user.role === 'manager' || req.user.role === 'admin') && ticketDept !== req.user.department) {
      return res.status(403).json({ msg: 'cross-department create not allowed' });
    }

    // If assigning, validate assignee exists and is same department
    if (assignedTo) {
      const assignee = await User.findById(assignedTo).select('department');
      if (!assignee) return res.status(400).json({ msg: 'assignee not found' });
      if (assignee.department !== ticketDept) {
        return res.status(403).json({ msg: 'assignee must be in same department' });
      }
    }

    const doc = await Ticket.create({
      title,
      description,
      priority,
      createdBy: targetUserId,
      assignedTo,
      department: ticketDept,
      status: 'open',
    });

    return res.status(201).json({ ticket_id: doc._id });
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
        .populate('assignedTo', 'name email role department');
  
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
