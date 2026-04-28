require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  env: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT || 3000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:3000/api/auth/google/callback"
  }
};
