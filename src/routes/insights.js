const express = require("express");
const prisma = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { dateRange } = require("../utils/date");
const { summarizeHabits } = require("../services/insights");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const range = dateRange(30);
    const [habits, logs, goals] = await Promise.all([
      prisma.habit.findMany({ where: { userId: req.user.id } }),
      prisma.habitLog.findMany({
        where: {
          userId: req.user.id,
          date: {
            in: range
          }
        }
      }),
      prisma.goal.findMany({ where: { userId: req.user.id } })
    ]);

    res.json(summarizeHabits({ habits, logs, goals }));
  })
);

module.exports = router;
