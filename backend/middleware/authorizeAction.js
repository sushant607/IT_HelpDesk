const mongoose = require('mongoose');

// Role helpers
function requireRole(...allowed) {
  return (req, res, next) => {
    const ok = allowed.includes(req.user.role);
    if (!ok) return res.status(403).json({ msg: 'Forbidden' });
    return next();
  };
}

// Listing scope: employee → self only; manager/admin → department only (not beyond team)
function listScope(req) {
    const role = req.user.role;
    if (role === 'employee') {
      return { createdBy: new mongoose.Types.ObjectId(req.user.id) };
    }
    // manager/admin: restrict to department
    return { department: req.user.department };
  }

  function canAccessTeamScope(req) {
    const role = req.user.role;
    return role === 'manager' || role === 'admin';
  }

// Create permissions
// - employee: only for itself
// - manager/admin: can create for self or others in same department
function canCreateFor(req, targetUserId) {
  const role = req.user.role;
  if (role === 'employee') {
    return targetUserId === req.user.id;
  }
  // manager/admin: allow if same department or unspecified (server will set dept)
  return true;
}

// Update permissions
// - employee: only if creator and only own ticket
// - manager/admin: may edit tickets in same department; not beyond department
async function canUpdate(req, ticket) {
  if (!ticket) return false;
  if (req.user.role === 'employee') {
    return String(ticket.createdBy) === req.user.id;
  }
  // Managers/admins limited to their department
  return ticket.department === req.user.department;
}

// Delete permissions
// - employee: only if creator (self-delete)
// - manager/admin: allowed within same department
async function canDelete(req, ticket) {
  if (!ticket) return false;
  if (req.user.role === 'employee') {
    return String(ticket.createdBy) === req.user.id;
  }
  return ticket.department === req.user.department;
}

// Mark complete
// - manager/admin only; within department
async function canMarkComplete(req, ticket) {
  if (!ticket) return false;
  if (req.user.role === 'manager' || req.user.role === 'admin') {
    return ticket.department === req.user.department;
  }
  return false;
}

// Assign permissions
// - only manager/admin
// - ticket must be in manager/admin's department
// - assignee (if provided) must exist and be in the same department as the ticket
async function canAssign(req, ticket, assigneeUser) {
    if (!ticket) return false;
    const isPrivileged = req.user.role === 'manager' || req.user.role === 'admin';
    if (!isPrivileged) return false;
    if (ticket.department !== req.user.department) return false;
    if (assigneeUser && assigneeUser.department !== ticket.department) return false;
    return true;
  }
  
  

module.exports = {
  requireRole,
  listScope,
  canAccessTeamScope,
  canCreateFor,
  canUpdate,
  canDelete,
  canMarkComplete,
  canAssign 
};
