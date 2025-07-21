const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Caramelo API",
      version: "1.0.0",
      description: "API documentation for Caramelo",
      contact: {
        name: "Caramelo Team",
        email: "support@caramelo.com",
      },
    },
    servers: [
      {
        url: process.env.SERVER_HOST + ":" + process.env.SERVER_PORT,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            phone: { type: "string" },
            role: { type: "string", enum: ["consumer", "client"] },
            status: { type: "string", enum: ["available", "unavailable", "pending"] },
            excluded: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Company: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            phone: { type: "string" },
            document: { type: "string" },
            logo: { type: "string" },
            address: {
              type: "object",
              properties: {
                zipcode: { type: "string" },
                street: { type: "string" },
                number: { type: "number" },
                complement: { type: "string" },
                neighborhood: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                location: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    coordinates: { type: "array", items: { type: "number" } },
                  },
                },
              },
            },
            segment: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                icon: { type: "string" },
              },
            },
            status: { type: "string", enum: ["available", "unavailable", "pending"] },
            excluded: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Card: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            credits_needed: { type: "number" },
            credit_expires_at: {
              type: "object",
              properties: {
                ref_number: { type: "number" },
                ref_type: { type: "string" },
              },
            },
            company_id: { type: "string" },
            status: { type: "string", enum: ["available", "unavailable", "pending"] },
            excluded: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Credit: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user_id: { type: "string" },
            card_id: { type: "string" },
            company_id: { type: "string" },
            status: { type: "string", enum: ["available", "pending", "used", "rejected"] },
            excluded: { type: "boolean" },
            expires_at: { type: "string", format: "date-time" },
            requested_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Segment: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            icon: { type: "string" },
            status: { type: "string", enum: ["available", "unavailable", "pending"] },
            excluded: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            name: { type: "string" },
            message: { type: "string" },
            action: { type: "string" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/**/*.js", "./controllers/**/*.js", "./validators/**/*.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
