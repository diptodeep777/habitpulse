const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@habitpulse.app" },
    update: {},
    create: {
      email: "demo@habitpulse.app",
      name: "Demo User",
      passwordHash
    }
  });

  const habits = [
    { title: "Morning workout", category: "Fitness", color: "#00b894", icon: "activity" },
    { title: "Deep work sprint", category: "Focus", color: "#6c5ce7", icon: "target" },
    { title: "Read 10 pages", category: "Learning", color: "#fdcb6e", icon: "book" }
  ];

  for (const habit of habits) {
    await prisma.habit.create({
      data: {
        userId: user.id,
        ...habit
      }
    });
  }

  await prisma.goal.createMany({
    data: [
      { userId: user.id, title: "Complete 4 priority habits today", horizon: "DAILY", targetValue: 4, currentValue: 2, unit: "habits" },
      { userId: user.id, title: "Hit 80 habit check-ins this month", horizon: "MONTHLY", targetValue: 80, currentValue: 31, unit: "check-ins" },
      { userId: user.id, title: "Build a 200-day fitness identity", horizon: "YEARLY", targetValue: 200, currentValue: 44, unit: "days" }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
