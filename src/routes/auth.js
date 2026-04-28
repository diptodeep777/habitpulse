const express = require("express");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { z } = require("zod");
const prisma = require("../db");
const config = require("../config");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, setAuthCookie, signAuthToken } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1)
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    provider: user.provider
  };
}

if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(new Error("Google account has no verified email."));
          }

          const avatarUrl = profile.photos?.[0]?.value;
          const user = await prisma.user.upsert({
            where: { email },
            update: {
              googleId: profile.id,
              provider: "GOOGLE",
              avatarUrl
            },
            create: {
              email,
              name: profile.displayName || email.split("@")[0],
              googleId: profile.id,
              provider: "GOOGLE",
              avatarUrl
            }
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });

    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash
      }
    });

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    return res.json({ user: publicUser(user) });
  })
);

router.post("/logout", (req, res) => {
  res.clearCookie("hp_session");
  res.status(204).send();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get("/google/status", (req, res) => {
  res.json({ enabled: Boolean(config.google.clientId && config.google.clientSecret) });
});

router.get("/google", (req, res, next) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(501).json({ message: "Google login is not configured yet." });
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!config.google.clientId || !config.google.clientSecret) {
      return res.redirect("/?auth=google-not-configured");
    }
    return next();
  },
  passport.authenticate("google", {
    failureRedirect: "/?auth=google-failed",
    session: false
  }),
  (req, res) => {
    const token = signAuthToken(req.user);
    setAuthCookie(res, token);
    res.redirect("/app.html");
  }
);

module.exports = router;
