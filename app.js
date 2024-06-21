// Load environment variables
require("dotenv").config();

// Load modules
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const mongoose = require("mongoose");
const bp = require("body-parser");
const helmet = require('helmet');
const { I18n } = require("i18n");

// Load i18n
const i18n = new I18n({
    locales: ["pt_BR"],
    directory: __dirname + "/locales",
    defaultLocale: "pt_BR",
    objectNotation: true
});

// Rate Limiter
const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

// Speed Limiter
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 100,
    delayMs: 500
});

// Load database
const mongoString = process.env.DATABASE_URL;
mongoose.connect(mongoString);
const database = mongoose.connection;

database.on("error", (error) => {
    console.log(error)
})

database.once("connected", () => {
    console.log("Database Connected");
});

// Load routes
const routes = require("./routes");

// Load express server
const app = express();

// Logger middleware
app.use((req, res, next) => {
    if (req.method !== 'OPTIONS') {
        const now = new Date();
        const formattedDate = now.toISOString();
        const { method, originalUrl } = req;

        res.on('finish', () => {
            const { statusCode } = res;
            console.log(`[${formattedDate}] ${method} ${originalUrl} - ${statusCode}`);
        });
    }
    next();
});

// CORS
const allowedOrigins = ['http://localhost:3000', 'http://192.168.100.4:3000'];
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
    res.set("Referrer-Policy", "same-origin");
    next();
});

//app.use(helmet());
app.use(rateLimiter);
app.use(speedLimiter);
app.use(i18n.init);
app.use(bp.json());
app.use(bp.urlencoded({ extended: true }));
app.use("/api", routes);

app.listen(3001, () => {
    console.log(`Running on port ${3001}`)
});