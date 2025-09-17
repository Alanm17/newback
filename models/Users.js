const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  tenantId: { type: String, required: true }, // link to tenant
});

module.exports = mongoose.model("User", UserSchema);
