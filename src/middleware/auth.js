const jwt = require("jsonwebtoken");
const prisma = require("../db");
const config = require("../config");

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  res.cookie("hp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

async function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.replace("Bearer ", "");
  const token = req.cookies.hp_session || bearer;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        provider: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: "Session user no longer exists." });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

module.exports = {
  requireAuth,
  setAuthCookie,
  signAuthToken
};
