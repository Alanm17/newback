const mongoose = require("mongoose");

const TenantSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: String,
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

module.exports = mongoose.model("Tenant", TenantSchema);

// instead of dummy function
async function fetchTenantData(tenantId) {
  return Tenant.findOne({ id: tenantId });
}

module.exports.fetchTenantData = fetchTenantData;
