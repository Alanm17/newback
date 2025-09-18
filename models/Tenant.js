// models/Tenant.js
const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  domain: String,
  logo: String,
  config: {
    theme: String,
    features: {
      analytics: Boolean,
      userManagement: Boolean,
      chat: Boolean,
      notifications: Boolean,
    },
    primaryColor: String,
  },
});

const Tenant = mongoose.model("Tenant", tenantSchema);

// 👇 This replaces your old fetch function
const fetchTenantData = async (tenantId) => {
  return Tenant.findOne({ id: parseInt(tenantId, 10) });
};

module.exports = Tenant;
module.exports.fetchTenantData = fetchTenantData;
