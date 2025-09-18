const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const connectDB = require("./config/db");
connectDB();

const userRoutes = require("./routes/userRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const { fetchTenantData } = require("./models/Tenant");
const swaggerDocs = require("./swagger");
const app = express();
const server = http.createServer(app);
swaggerDocs(app);

const PORT = process.env.PORT || 3001;

// ===== Cache Settings =====
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const tenantCache = {};

// ===== Middleware =====
app.use(
  cors({
    origin: [
      "https://dashbro.netlify.app", // ✅ Netlify frontend
      "http://localhost:5173", // ✅ Vite local dev
    ],
    credentials: true, // ✅ allow cookies / auth headers
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Performance Logging =====
app.use((req, res, next) => {
  req.startTime = Date.now();
  console.log(
    `[${req.method}] ${req.path} - Origin: ${req.headers.origin || "none"}`
  );

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const duration = Date.now() - req.startTime;
    console.log(
      `[${req.method}] ${req.path} - ${duration}ms - Status: ${res.statusCode}`
    );
    return originalJson(body);
  };
  next();
});

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});
// server.js
app.get("/api/tenant/:id/settings", async (req, res) => {
  try {
    const tenant = await Tenant.findOne(
      { id: req.params.id },
      "config name logo"
    );
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    res.json({
      success: true,
      settings: tenant.config,
      name: tenant.name,
      logo: tenant.logo,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Multi-tenant API Server",
    version: "1.0.0",
    endpoints: {
      health: "/healthz",
      tenant: "/api/tenant",
      analytics: "/api/analytics",
      users: "/api/users",
    },
  });
});

// Tenant Middleware Example (still used by tenant route)
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"];
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const cacheKey = `tenant_${tenantId}`;
  const cached = tenantCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    req.tenant = cached.data;
    return next();
  }

  try {
    const tenant = await fetchTenantData(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    tenantCache[cacheKey] = { data: tenant, timestamp: Date.now() };
    req.tenant = tenant;
    next();
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
};

// Tenant route
app.get("/api/tenant", tenantMiddleware, (req, res) => {
  res.json({ success: true, data: req.tenant });
});

// ===== 404 Handler =====
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
