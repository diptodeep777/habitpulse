const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const goalSchema = z.object({
  title: z.string().trim().min(2).max(140),
  horizon: z.enum(["DAILY", "MONTHLY", "YEARLY"]),
  targetValue: z.coerce.number().int().min(1).max(100000),
  currentValue: z.coerce.number().int().min(0).max(100000).default(0),
  unit: z.string().trim().min(1).max(40).default("times"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED"]).default("ACTIVE")
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });

    res.json({ goals });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = goalSchema.parse(req.body);
    const goal = await prisma.goal.create({
      data: {
        userId: req.user.id,
        ...input,
        status: input.currentValue >= input.targetValue ? "COMPLETED" : input.status
      }
    });

    res.status(201).json({ goal });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = goalSchema.partial().parse(req.body);
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: "Goal not found." });
    }

    const targetValue = input.targetValue ?? existing.targetValue;
    const currentValue = input.currentValue ?? existing.currentValue;
    const status =
      input.status ?? (currentValue >= targetValue ? "COMPLETED" : existing.status);

    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data: {
        ...input,
        status
      }
    });

    return res.json({ goal });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.goal.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!result.count) {
      return res.status(404).json({ message: "Goal not found." });
    }

    return res.status(204).send();
  })
);

module.exports = router;
