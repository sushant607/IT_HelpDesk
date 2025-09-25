const express = require("express");
const multer = require("multer"); // ADD THIS MISSING IMPORT
const router = express.Router();
const parser = require("../upload");

router.post("/", parser.single("file"), (req, res) => {
  try {
    console.log('Upload route hit');
    console.log('Request file:', req.file);
    
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ msg: "No file uploaded" });
    }

    // req.file.path contains the Cloudinary URL
    console.log('File uploaded successfully:', {
      url: req.file.path,
      filename: req.file.originalname,
      public_id: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Return the file information
    res.json({ 
      url: req.file.path, 
      public_id: req.file.filename, 
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
  } catch (error) {
    console.error('Upload route error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      msg: "Server error during file upload",
      error: error.message 
    });
  }
});

// Add error handling middleware
router.use((error, req, res, next) => {
  console.error('Upload middleware error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ msg: `Upload error: ${error.message}` });
  }
  
  // Handle Cloudinary format errors
  if (error.message && error.message.includes('format not allowed')) {
    return res.status(400).json({ 
      msg: 'File format not supported. Please upload images, PDFs, or common document types.' 
    });
  }
  
  return res.status(500).json({ msg: 'Upload failed', error: error.message });
});

module.exports = router;
