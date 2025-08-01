const express = require("express");
const cors = require("cors");
const http = require("http");
const bodyParser = require("body-parser");
require("dotenv").config();

const { Users } = require("./models/Users");
const { fetchTenantData } = require("./models/Tenant");
const { analyticsController } = require("./controllers/analyticsController");

const app = express();
const server = http.createServer(app);

// ===== FIXED: Use environment port or default =====
const PORT = process.env.PORT || 3001;

// ===== Cache Settings =====
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const tenantCache = {};
const analyticsCache = {};
const usersCache = {};

// ===== FIXED: Comprehensive CORS Configuration =====
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "https://dashbro.netlify.app",
      "http://localhost:3000",
      "http://localhost:3001",
      "https://backend-js-tzs3.onrender.com",
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Tenant-ID",
    "Origin",
    "X-Requested-With",
    "Accept",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));

// ===== ADDITIONAL: Manual CORS headers for extra compatibility =====
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://dashbro.netlify.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Tenant-ID, Origin, X-Requested-With, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  next();
});

// ===== Body Parser Middleware =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===== Performance Logging Middleware =====
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

// ===== Test CORS Route =====
app.get("/api/cors-test", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working!",
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
  });
});

// ... rest of your existing routes remain the same ...

// ===== Tenant Middleware (with Cache) =====
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"];

  if (!tenantId || typeof tenantId !== "string") {
    return res.status(400).json({
      error: "Tenant ID is required",
      message: "Please provide a valid X-Tenant-ID header",
    });
  }

  const cacheKey = `tenant_${tenantId}`;
  const cached = tenantCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    req.tenant = cached.data;
    return next();
  }

  try {
    const tenant = await fetchTenantData(tenantId);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
        message: `No tenant found with ID: ${tenantId}`,
      });
    }

    tenantCache[cacheKey] = { data: tenant, timestamp: Date.now() };
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error("Tenant middleware error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch tenant data",
    });
  }
};

// ===== Feature Toggle Middleware =====
const checkFeature = (feature) => (req, res, next) => {
  if (!req.tenant?.config?.features?.[feature]) {
    return res.status(403).json({
      error: `Feature not enabled`,
      message: `${feature} is not enabled for tenant: ${
        req.tenant?.name || "Unknown"
      }`,
    });
  }
  next();
};

// ===== Health Check Route =====
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    port: PORT,
  });
});

// ===== Root Route =====
app.get("/", (req, res) => {
  res.json({
    message: "Multi-tenant API Server",
    version: "1.0.0",
    corsEnabled: true,
    endpoints: {
      health: "/healthz",
      corsTest: "/api/cors-test",
      tenant: "/api/tenant",
      analytics: "/api/analytics",
      users: "/api/users",
    },
  });
});

// ===== Tenant Info Route =====
app.get("/api/tenant", tenantMiddleware, (req, res) => {
  try {
    res.json({
      success: true,
      data: req.tenant,
      cached: true, // You could track this if needed
    });
  } catch (error) {
    console.error("Tenant route error:", error);
    res.status(500).json({
      error: "Failed to retrieve tenant information",
      message: error.message,
    });
  }
});

// ===== Analytics Route =====
app.get(
  "/api/analytics",
  tenantMiddleware,
  checkFeature("analytics"),
  async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"];
      const cacheKey = `analytics_${tenantId}`;

      // Check cache first
      const cached = analyticsCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({
          success: true,
          data: cached.data,
          cached: true,
          timestamp: cached.timestamp,
        });
      }

      // Fetch fresh analytics data
      let data;
      if (typeof analyticsController === "function") {
        data = await analyticsController(req.tenant);
      } else {
        data = analyticsController;
      }

      // Cache the result
      analyticsCache[cacheKey] = { data, timestamp: Date.now() };

      res.json({
        success: true,
        data: data,
        cached: false,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Analytics route error:", error);
      res.status(500).json({
        error: "Failed to retrieve analytics data",
        message: error.message,
      });
    }
  }
);

// ===== Users Route =====
app.get(
  "/api/users",
  tenantMiddleware,
  checkFeature("userManagement"),
  async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"];
      const cacheKey = `users_${tenantId}`;

      // Check cache first
      const cached = usersCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({
          success: true,
          data: cached.data,
          cached: true,
          timestamp: cached.timestamp,
        });
      }

      // Fetch fresh users data
      let data;
      if (Array.isArray(Users)) {
        data = Users;
      } else if (typeof Users === "function") {
        data = await Users(req.tenant);
      } else {
        data = [];
      }

      // Cache the result
      usersCache[cacheKey] = { data, timestamp: Date.now() };

      res.json({
        success: true,
        data: data,
        cached: false,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Users route error:", error);
      res.status(500).json({
        error: "Failed to retrieve users data",
        message: error.message,
      });
    }
  }
);

// ===== Cache Status Route (for debugging) =====
app.get("/api/cache/status", (req, res) => {
  const now = Date.now();
  const getCacheInfo = (cache, name) => {
    const keys = Object.keys(cache);
    const activeKeys = keys.filter(
      (key) => now - cache[key].timestamp < CACHE_TTL
    );
    return {
      name,
      totalEntries: keys.length,
      activeEntries: activeKeys.length,
      expiredEntries: keys.length - activeKeys.length,
    };
  };

  res.json({
    success: true,
    cacheStatus: [
      getCacheInfo(tenantCache, "tenant"),
      getCacheInfo(analyticsCache, "analytics"),
      getCacheInfo(usersCache, "users"),
    ],
    cacheTTL: CACHE_TTL,
    timestamp: now,
  });
});

// ===== 404 Handler =====
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      "GET /",
      "GET /healthz",
      "GET /api/tenant",
      "GET /api/analytics",
      "GET /api/users",
      "GET /api/cache/status",
    ],
  });
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
  console.error("Unhandled error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: isDevelopment ? err.message : "An unexpected error occurred",
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
});

// ===== Cache Cleanup Interval =====
const startCacheCleanup = () => {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let totalCleaned = 0;

    const cleanCache = (cache, name) => {
      const initialCount = Object.keys(cache).length;
      Object.keys(cache).forEach((key) => {
        if (now - cache[key].timestamp > CACHE_TTL) {
          delete cache[key];
        }
      });
      const finalCount = Object.keys(cache).length;
      const cleaned = initialCount - finalCount;
      if (cleaned > 0) {
        console.log(`♻️ Cleaned ${cleaned} expired entries from ${name} cache`);
      }
      return cleaned;
    };

    totalCleaned += cleanCache(tenantCache, "tenant");
    totalCleaned += cleanCache(analyticsCache, "analytics");
    totalCleaned += cleanCache(usersCache, "users");

    if (totalCleaned > 0) {
      console.log(
        `♻️ Cache cleanup completed: ${totalCleaned} total entries cleaned`
      );
    }
  }, CACHE_TTL);

  // Cleanup on process termination
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, clearing cache cleanup interval");
    clearInterval(cleanupInterval);
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, clearing cache cleanup interval");
    clearInterval(cleanupInterval);
  });
};

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 API available at: https://backend-js-tzs3.onrender.com`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ Cache TTL: ${CACHE_TTL / 1000}s`);
  console.log(`🔒 CORS enabled for: https://dashbro.netlify.app`);
});

// ===== Graceful Shutdown =====
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});
