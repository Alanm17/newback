const express = require("express");
const router = express.Router();
const User = require("../models/Users");

// Create new user
router.post("/", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users by tenant
router.get("/", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    if (!tenantId) return res.status(400).json({ error: "Tenant ID required" });

    const users = await User.find({ tenantId });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
