const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/Users");
const Tenant = require("./models/Tenant");
const Analytics = require("./models/analyticsController");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Insert tenant
    const tenant = await Tenant.create({
      id: 2,
      name: "SpaceX Corparation",
      domain: "spacex.example.com",
      logo: "🏢",
      config: {
        theme: "dark",
        features: {
          analytics: true,
          userManagement: false,
          chat: true,
          notifications: true,
        },
        primaryColor: "#3b82f6",
      },
    });

    // Insert user
    await User.create({
      name: "Margaret Jakichan",
      email: "margo.johnson@example.com",
      status: "Active",
      tenantId: tenant.id,
    });

    // Insert analytics
    await Analytics.create({
      tenantId: tenant.id,
      activeUsers: 1245,
      conversionRate: "3.4%",
      revenue: "$12,340",
      chartData: [
        { name: "Page A", uv: 590, pv: 800, amt: 1400, cnt: 490 },
        { name: "Page B", uv: 868, pv: 967, amt: 1506, cnt: 590 },
      ],
    });

    console.log("✅ Seed completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

seed();
