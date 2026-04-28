require("dotenv").config();

function cleanEnv(value, fallback = "") {
  return String(value || fallback)
    .trim()
    .replace(/[\r\n\t]/g, "")
    .replace(/\s+$/g, "");
}

const env = cleanEnv(process.env.NODE_ENV, "development");
const clientUrl = cleanEnv(process.env.CLIENT_URL, "http://localhost:3000").replace(/\/$/, "");
const isProduction = env === "production";

module.exports = {
  env,
  isProduction,
  port: Number(process.env.PORT || 3000),
  clientUrl,
  jwtSecret: cleanEnv(process.env.JWT_SECRET, "dev-only-secret-change-me"),
  google: {
    clientId: cleanEnv(process.env.GOOGLE_CLIENT_ID),
    clientSecret: cleanEnv(process.env.GOOGLE_CLIENT_SECRET),
    callbackUrl: cleanEnv(
      process.env.GOOGLE_CALLBACK_URL,
      "http://localhost:3000/api/auth/google/callback"
    )
  }
};
