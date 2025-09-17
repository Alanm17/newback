const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Multi-Tenant API",
      version: "1.0.0",
      description: "API documentation for your backend",
    },
    servers: [
      {
        url: "https://newback.onrender.com", // your Render URL
      },
    ],
  },
  apis: ["./routes/*.js"], // where your routes are documented
};

const swaggerSpec = swaggerJsDoc(options);

function swaggerDocs(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = swaggerDocs;
