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
  frequencyDays: z.string().trim().regex(/^[0-6](,[0-6])*$/).default("0,1,2,3,4,5,6"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#111827"),
  icon: z.string().trim().min(2).max(40).default("sparkles"),
  subHabits: z.array(z.string().trim().min(2).max(100)).max(12).default([])
});

const habitUpdateSchema = habitSchema.omit({ subHabits: true }).partial().extend({
  archived: z.boolean().optional()
});

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => toDateKey()),
  value: z.coerce.number().int().min(0).max(100).default(1),
  note: z.string().trim().max(400).optional().nullable(),
  mood: z.coerce.number().int().min(1).max(5).optional().nullable(),
  energy: z.coerce.number().int().min(1).max(5).optional().nullable()
});

const subHabitSchema = z.object({
  title: z.string().trim().min(2).max(100)
});

async function syncParentHabitLog({ userId, habitId, date }) {
  const subHabits = await prisma.subHabit.findMany({
    where: { userId, habitId },
    include: {
      logs: {
        where: { date },
        take: 1
      }
    }
  });

  if (!subHabits.length) return;

  const completed = subHabits.filter((subHabit) =>
    subHabit.logs.some((log) => log.value > 0)
  ).length;

  if (completed > 0) {
    await prisma.habitLog.upsert({
      where: {
        userId_habitId_date: {
          userId,
          habitId,
          date
        }
      },
      update: { value: 1 },
      create: {
        userId,
        habitId,
        date,
        value: 1
      }
    });
    return;
  }

  await prisma.habitLog.deleteMany({
    where: {
      userId,
      habitId,
      date
    }
  });
}

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
        },
        subHabits: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            logs: {
              where: { date: toDateKey() },
              take: 1
            }
          }
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
        title: input.title,
        category: input.category,
        cadence: input.cadence,
        targetPerPeriod: input.targetPerPeriod,
        frequencyDays: input.frequencyDays,
        color: input.color,
        icon: input.icon,
        subHabits: {
          create: input.subHabits.map((title, index) => ({
            userId: req.user.id,
            title,
            sortOrder: index
          }))
        }
      },
      include: {
        subHabits: true,
        logs: {
          where: { date: toDateKey() },
          take: 1
        }
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

router.post(
  "/:id/subhabits",
  asyncHandler(async (req, res) => {
    const input = subHabitSchema.parse(req.body);
    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { subHabits: true }
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const subHabit = await prisma.subHabit.create({
      data: {
        userId: req.user.id,
        habitId: habit.id,
        title: input.title,
        sortOrder: habit.subHabits.length
      }
    });

    return res.status(201).json({ subHabit });
  })
);

router.patch(
  "/:id/subhabits/:subHabitId",
  asyncHandler(async (req, res) => {
    const input = subHabitSchema.partial().parse(req.body);
    const subHabit = await prisma.subHabit.updateMany({
      where: {
        id: req.params.subHabitId,
        habitId: req.params.id,
        userId: req.user.id
      },
      data: input
    });

    if (!subHabit.count) {
      return res.status(404).json({ message: "Sub-habit not found." });
    }

    const updated = await prisma.subHabit.findUnique({ where: { id: req.params.subHabitId } });
    return res.json({ subHabit: updated });
  })
);

router.delete(
  "/:id/subhabits/:subHabitId",
  asyncHandler(async (req, res) => {
    const result = await prisma.subHabit.deleteMany({
      where: {
        id: req.params.subHabitId,
        habitId: req.params.id,
        userId: req.user.id
      }
    });

    if (!result.count) {
      return res.status(404).json({ message: "Sub-habit not found." });
    }

    return res.status(204).send();
  })
);

router.post(
  "/:id/subhabits/:subHabitId/logs",
  asyncHandler(async (req, res) => {
    const input = logSchema.pick({ date: true, value: true }).parse(req.body);
    const subHabit = await prisma.subHabit.findFirst({
      where: {
        id: req.params.subHabitId,
        habitId: req.params.id,
        userId: req.user.id
      }
    });

    if (!subHabit) {
      return res.status(404).json({ message: "Sub-habit not found." });
    }

    const log = await prisma.subHabitLog.upsert({
      where: {
        userId_subHabitId_date: {
          userId: req.user.id,
          subHabitId: subHabit.id,
          date: input.date
        }
      },
      update: input,
      create: {
        userId: req.user.id,
        subHabitId: subHabit.id,
        ...input
      }
    });

    await syncParentHabitLog({
      userId: req.user.id,
      habitId: req.params.id,
      date: input.date
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
