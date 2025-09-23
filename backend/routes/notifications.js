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



module.exports = router;
