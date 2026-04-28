const { dateRange, toDateKey } = require("../utils/date");

function calculateStreak(logsByDate) {
  let streak = 0;
  let cursor = new Date();

  while (logsByDate.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function buildSuggestions({ activeHabits, logs, goals, completionRate, streak }) {
  const suggestions = [];
  const today = toDateKey();
  const checkedToday = new Set(
    logs.filter((log) => log.date === today && log.value > 0).map((log) => log.habitId)
  );
  const missedHabits = activeHabits.filter((habit) => !checkedToday.has(habit.id));

  if (missedHabits.length > 0) {
    suggestions.push({
      title: `Protect today's momentum`,
      body: `You still have ${missedHabits.length} habit${missedHabits.length === 1 ? "" : "s"} open. Start with "${missedHabits[0].title}" because quick wins make the rest easier.`,
      tone: "focus"
    });
  }

  if (completionRate >= 80) {
    suggestions.push({
      title: "Level up carefully",
      body: "Your consistency is strong. Add a tiny stretch target to one habit instead of adding multiple new habits at once.",
      tone: "growth"
    });
  } else if (completionRate < 45 && activeHabits.length > 3) {
    suggestions.push({
      title: "Reduce friction",
      body: "Your plan may be too heavy right now. Pause one low-priority habit for a week and make the remaining habits easier to start.",
      tone: "recovery"
    });
  }

  if (streak >= 7) {
    suggestions.push({
      title: `${streak}-day streak energy`,
      body: "You have a real streak going. Create a fallback version of your hardest habit so travel or busy days do not break it.",
      tone: "streak"
    });
  }

  const riskyGoal = goals.find((goal) => {
    if (goal.status !== "ACTIVE") return false;
    const progress = goal.targetValue === 0 ? 0 : goal.currentValue / goal.targetValue;
    return progress < 0.35;
  });

  if (riskyGoal) {
    suggestions.push({
      title: "Goal rescue move",
      body: `"${riskyGoal.title}" needs attention. Schedule one small action for it today and update the progress counter after.`,
      tone: "goal"
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: "Steady and clean",
      body: "Your system is balanced. Keep the same plan for a few more days before making changes.",
      tone: "steady"
    });
  }

  return suggestions.slice(0, 4);
}

function summarizeHabits({ habits, logs, goals }) {
  const activeHabits = habits.filter((habit) => !habit.archived);
  const lastSeven = dateRange(7);
  const lastThirty = dateRange(30);
  const logsByDate = new Map();
  const logsByHabit = new Map();

  for (const log of logs) {
    if (log.value > 0) {
      logsByDate.set(log.date, (logsByDate.get(log.date) || 0) + log.value);
      logsByHabit.set(log.habitId, (logsByHabit.get(log.habitId) || 0) + log.value);
    }
  }

  const expectedThirty = Math.max(activeHabits.length * 30, 1);
  const completedThirty = logs.filter((log) => lastThirty.includes(log.date) && log.value > 0).length;
  const completionRate = Math.round((completedThirty / expectedThirty) * 100);
  const today = toDateKey();
  const checkedToday = logs.filter((log) => log.date === today && log.value > 0).length;
  const streak = calculateStreak(logsByDate);

  const weekly = lastSeven.map((date) => ({
    date,
    count: logsByDate.get(date) || 0,
    target: activeHabits.length
  }));

  const categories = activeHabits.reduce((acc, habit) => {
    const existing = acc[habit.category] || { category: habit.category, habits: 0, completions: 0 };
    existing.habits += 1;
    existing.completions += logsByHabit.get(habit.id) || 0;
    acc[habit.category] = existing;
    return acc;
  }, {});

  const topHabits = activeHabits
    .map((habit) => ({
      id: habit.id,
      title: habit.title,
      category: habit.category,
      color: habit.color,
      completions: logsByHabit.get(habit.id) || 0
    }))
    .sort((a, b) => b.completions - a.completions)
    .slice(0, 5);

  return {
    stats: {
      activeHabits: activeHabits.length,
      checkedToday,
      completionRate: Math.min(completionRate, 100),
      streak,
      activeGoals: goals.filter((goal) => goal.status === "ACTIVE").length
    },
    weekly,
    categories: Object.values(categories),
    topHabits,
    suggestions: buildSuggestions({
      activeHabits,
      logs,
      goals,
      completionRate,
      streak
    })
  };
}

module.exports = {
  summarizeHabits
};
