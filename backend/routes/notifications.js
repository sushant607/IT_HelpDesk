const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// PUT /api/notifications/all/read
router.put('/all/read', auth, async (req, res) => {
  try {
   
    const result = await Notification.updateMany(
      { user: req.user.id, read: false }, 
      { read: true }
    );

    res.json({
      msg: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get notifications for current user
router.get('/', auth, async (req, res) => {
  try {
   
    const notes = await Notification.find({user: req.user.id}).sort({ createdAt: -1 });
   
    res.json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Mark as read
router.put('/:id/read', auth, async (req, res) => {
  try {
  
    const note = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
   
    res.json(note);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find and delete the notification for the logged-in user
    const note = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!note) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    res.json({ msg: 'Notification deleted successfully', deletedId: req.params.id });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST /api/notifications/remind/:ticketId - Only for managers
router.post('/remind/:ticketId', auth, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const User = require('../models/User');
    
    // Get current user to check role
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Check if user is a manager
    if (currentUser.role !== 'manager') {
      return res.status(403).json({ msg: 'Access denied. Only managers can send reminders.' });
    }
    
    // Find the ticket and populate assignedTo and createdBy
    const ticket = await Ticket.findById(req.params.ticketId)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    
    if (!ticket) {
      return res.status(404).json({ msg: 'Ticket not found' });
    }
    
    // Check if ticket has an assignee
    if (!ticket.assignedTo) {
      return res.status(400).json({ msg: 'Ticket has no assignee to remind' });
    }
    
    // Create notification for the assignee
    const notification = new Notification({
      user: ticket.assignedTo._id,
      title: `Manager Reminder: Ticket "${ticket.title}"`,
      message: `Manager ${currentUser.name} sent you a reminder about ticket: "${ticket.title}". Priority: ${ticket.priority.toUpperCase()}. Status: ${ticket.status.replace('_', ' ').toUpperCase()}.`,
      type: 'manager_reminder',
      ticketId: ticket._id,
      read: false
    });
    
    await notification.save();
    
    res.json({ 
      msg: 'Manager reminder sent successfully',
      assigneeName: ticket.assignedTo.name,
      ticketTitle: ticket.title,
      managerName: currentUser.name
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


module.exports = router;
