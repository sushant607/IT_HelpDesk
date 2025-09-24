const express = require("express");
const router = express.Router();
const parser = require("../upload");

router.post("/", parser.single("file"), (req, res) => {
  try {
   
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }
    // req.file.path contains the Cloudinary URL
    console.log(req.file);
    res.json({ url: req.file.path, public_id: req.file.filename , filename:req.file.originalname});
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
