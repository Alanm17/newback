const express = require("express");
const router = express.Router();
const Analytics = require("../models/analyticsController");

router.get("/", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    if (!tenantId) return res.status(400).json({ error: "Tenant ID required" });

    const analytics = await Analytics.findOne({ tenantId });
    if (!analytics) {
      return res.status(404).json({ error: "Analytics not found" });
    }

    res.json({ success: true, data: analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
