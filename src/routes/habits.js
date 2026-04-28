const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { toDateKey } = require("../utils/date");

const router = express.Router();

const habitSchema = z.object({
  title: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60).default("Lifestyle"),
  cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
  targetPerPeriod: z.coerce.number().int().min(1).max(365).default(1),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#111827"),
  icon: z.string().trim().min(2).max(40).default("sparkles")
});

const habitUpdateSchema = habitSchema.partial().extend({
  archived: z.boolean().optional()
});

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => toDateKey()),
  value: z.coerce.number().int().min(1).max(100).default(1),
  note: z.string().trim().max(400).optional().nullable(),
  mood: z.coerce.number().int().min(1).max(5).optional().nullable(),
  energy: z.coerce.number().int().min(1).max(5).optional().nullable()
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const habits = await prisma.habit.findMany({
      where: { userId: req.user.id },
      orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
      include: {
        logs: {
          where: { date: toDateKey() },
          take: 1
        }
      }
    });

    res.json({ habits });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = habitSchema.parse(req.body);
    const habit = await prisma.habit.create({
      data: {
        userId: req.user.id,
        ...input
      }
    });

    res.status(201).json({ habit });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = habitUpdateSchema.parse(req.body);
    const habit = await prisma.habit.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: input
    });

    if (!habit.count) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const updated = await prisma.habit.findUnique({ where: { id: req.params.id } });
    return res.json({ habit: updated });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.habit.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!result.count) {
      return res.status(404).json({ message: "Habit not found." });
    }

    return res.status(204).send();
  })
);

router.post(
  "/:id/logs",
  asyncHandler(async (req, res) => {
    const input = logSchema.parse(req.body);
    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const log = await prisma.habitLog.upsert({
      where: {
        userId_habitId_date: {
          userId: req.user.id,
          habitId: habit.id,
          date: input.date
        }
      },
      update: input,
      create: {
        userId: req.user.id,
        habitId: habit.id,
        ...input
      }
    });

    return res.json({ log });
  })
);

router.delete(
  "/:id/logs/:date",
  asyncHandler(async (req, res) => {
    await prisma.habitLog.deleteMany({
      where: {
        userId: req.user.id,
        habitId: req.params.id,
        date: req.params.date
      }
    });

    return res.status(204).send();
  })
);

module.exports = router;
