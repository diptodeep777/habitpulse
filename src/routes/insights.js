const express = require("express");
const prisma = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { dateRange, monthRange } = require("../utils/date");
const { summarizeHabits } = require("../services/insights");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const range = Array.from(new Set([...dateRange(30), ...monthRange()]));
    const [habits, logs, goals, subHabits, subHabitLogs] = await Promise.all([
      prisma.habit.findMany({ where: { userId: req.user.id } }),
      prisma.habitLog.findMany({
        where: {
          userId: req.user.id,
          date: {
            in: range
          }
        }
      }),
      prisma.goal.findMany({ where: { userId: req.user.id } }),
      prisma.subHabit.findMany({ where: { userId: req.user.id } }),
      prisma.subHabitLog.findMany({
        where: {
          userId: req.user.id,
          date: {
            in: range
          }
        }
      })
    ]);

    res.json(summarizeHabits({ habits, logs, goals, subHabits, subHabitLogs }));
  })
);

module.exports = router;
