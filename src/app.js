const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const passport = require("passport");
const config = require("./config");
const authRoutes = require("./routes/auth");
const habitRoutes = require("./routes/habits");
const goalRoutes = require("./routes/goals");
const insightRoutes = require("./routes/insights");
const { errorHandler, notFound } = require("./middleware/error");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === config.clientUrl) {
        return callback(null, true);
      }

      if (!config.isProduction && origin.startsWith("http://localhost:")) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.isProduction,
      sameSite: "lax"
    }
  })
);
app.use(passport.initialize());

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "HabitPulse", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/insights", insightRoutes);

app.use("/api", notFound);
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
app.use(errorHandler);

module.exports = app;
