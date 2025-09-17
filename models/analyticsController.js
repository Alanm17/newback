const mongoose = require("mongoose");

const AnalyticsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  activeUsers: Number,
  conversionRate: String,
  revenue: String,
  chartData: [
    { name: String, uv: Number, pv: Number, amt: Number, cnt: Number },
  ],
});

module.exports = mongoose.model("Analytics", AnalyticsSchema);
