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

function weekdayIndex(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function frequencySet(habit) {
  return new Set(
    String(habit.frequencyDays || "0,1,2,3,4,5,6")
      .split(",")
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

function isScheduled(habit, dateKey) {
  return frequencySet(habit).has(weekdayIndex(dateKey));
}

function buildSuggestions({ activeHabits, logs, goals, completionRate, streak, missedToday }) {
  const suggestions = [];
  const today = toDateKey();
  const checkedToday = new Set(
    logs.filter((log) => log.date === today && log.value > 0).map((log) => log.habitId)
  );
  const markedNotDone = new Set(
    logs.filter((log) => log.date === today && log.value === 0).map((log) => log.habitId)
  );
  const missedHabits = activeHabits.filter(
    (habit) => isScheduled(habit, today) && !checkedToday.has(habit.id)
  );

  if (markedNotDone.size > 0) {
    suggestions.push({
      title: "Smart reset plan",
      body: `${markedNotDone.size} habit${markedNotDone.size === 1 ? " was" : "s were"} marked not done today. Pick one tiny recovery action before sleep so the system still gets feedback.`,
      tone: "ai"
    });
  }

  if (missedHabits.length > 0 && missedToday === 0) {
    suggestions.push({
      title: `Protect today's momentum`,
      body: `You still have ${missedHabits.length} habit${missedHabits.length === 1 ? "" : "s"} open. Start with "${missedHabits[0].title}" because quick wins make the rest easier.`,
      tone: "focus"
    });
  }

  if (completionRate >= 80) {
    suggestions.push({
      title: "AI coach: level up carefully",
      body: "Your consistency is strong. Add a tiny stretch target to one habit instead of adding multiple new habits at once.",
      tone: "ai"
    });
  } else if (completionRate < 45 && activeHabits.length > 3) {
    suggestions.push({
      title: "AI coach: reduce friction",
      body: "Your plan may be too heavy right now. Pause one low-priority habit for a week and make the remaining habits easier to start.",
      tone: "ai"
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

function buildMilestones({ streak, completionRate, completedThirty, goals }) {
  const completedGoals = goals.filter((goal) => goal.status === "COMPLETED").length;
  const milestones = [
    {
      title: "First spark",
      body: "Complete your first habit check-in.",
      achieved: completedThirty >= 1,
      icon: "stars"
    },
    {
      title: "7-day pulse",
      body: "Reach a 7-day activity streak.",
      achieved: streak >= 7,
      icon: "fire"
    },
    {
      title: "Consistency pro",
      body: "Hold 80% consistency over the last 30 days.",
      achieved: completionRate >= 80,
      icon: "graph-up-arrow"
    },
    {
      title: "Goal finisher",
      body: "Complete any daily, monthly, or yearly goal.",
      achieved: completedGoals > 0,
      icon: "trophy"
    }
  ];

  const next = milestones.find((milestone) => !milestone.achieved) || milestones[milestones.length - 1];
  return { milestones, next };
}

function summarizeHabits({ habits, logs, goals, subHabits = [], subHabitLogs = [] }) {
  const activeHabits = habits.filter((habit) => !habit.archived);
  const lastSeven = dateRange(7);
  const lastThirty = dateRange(30);
  const logsByDate = new Map();
  const logsByHabit = new Map();
  const missesByDate = new Map();
  const subLogsByDate = new Map();
  const subHabitById = new Map(subHabits.map((subHabit) => [subHabit.id, subHabit]));

  for (const log of logs) {
    if (log.value > 0) {
      logsByDate.set(log.date, (logsByDate.get(log.date) || 0) + log.value);
      logsByHabit.set(log.habitId, (logsByHabit.get(log.habitId) || 0) + log.value);
    } else {
      missesByDate.set(log.date, (missesByDate.get(log.date) || 0) + 1);
    }
  }

  for (const log of subHabitLogs) {
    if (log.value > 0) {
      subLogsByDate.set(log.date, (subLogsByDate.get(log.date) || 0) + 1);
    }
  }

  const expectedThirty = Math.max(
    lastThirty.reduce(
      (total, date) => total + activeHabits.filter((habit) => isScheduled(habit, date)).length,
      0
    ),
    1
  );
  const completedThirty = logs.filter((log) => {
    const habit = activeHabits.find((item) => item.id === log.habitId);
    return habit && lastThirty.includes(log.date) && log.value > 0 && isScheduled(habit, log.date);
  }).length;
  const completionRate = Math.round((completedThirty / expectedThirty) * 100);
  const today = toDateKey();
  const todayHabits = activeHabits.filter((habit) => isScheduled(habit, today));
  const checkedToday = logs.filter((log) => {
    const habit = todayHabits.find((item) => item.id === log.habitId);
    return habit && log.date === today && log.value > 0;
  }).length;
  const missedToday = logs.filter((log) => {
    const habit = todayHabits.find((item) => item.id === log.habitId);
    return habit && log.date === today && log.value === 0;
  }).length;
  const streak = calculateStreak(logsByDate);

  const weekly = lastSeven.map((date) => {
    const scheduledHabits = activeHabits.filter((habit) => isScheduled(habit, date));
    const todoTotal = subHabits.filter((subHabit) => {
      const habit = activeHabits.find((item) => item.id === subHabit.habitId);
      return habit && isScheduled(habit, date);
    }).length;

    return {
      date,
      count: logsByDate.get(date) || 0,
      missed: missesByDate.get(date) || 0,
      subCompleted: subLogsByDate.get(date) || 0,
      todoTotal,
      target: scheduledHabits.length
    };
  });

  const monthly = lastThirty.map((date) => {
    const scheduledHabits = activeHabits.filter((habit) => isScheduled(habit, date));
    const todoTotal = subHabits.filter((subHabit) => {
      const habit = activeHabits.find((item) => item.id === subHabit.habitId);
      return habit && isScheduled(habit, date);
    }).length;
    const count = logsByDate.get(date) || 0;
    const subCompleted = subLogsByDate.get(date) || 0;

    return {
      date,
      count,
      missed: missesByDate.get(date) || 0,
      subCompleted,
      todoTotal,
      target: scheduledHabits.length,
      habitPercent: scheduledHabits.length ? Math.round((count / scheduledHabits.length) * 100) : 100,
      todoPercent: todoTotal ? Math.round((subCompleted / todoTotal) * 100) : 100
    };
  });

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
      scheduledToday: todayHabits.length,
      checkedToday,
      missedToday,
      completionRate: Math.min(completionRate, 100),
      streak,
      activeGoals: goals.filter((goal) => goal.status === "ACTIVE").length,
      subHabits: subHabits.length
    },
    weekly,
    monthly,
    categories: Object.values(categories),
    topHabits,
    milestones: buildMilestones({
      streak,
      completionRate: Math.min(completionRate, 100),
      completedThirty,
      goals
    }),
    suggestions: buildSuggestions({
      activeHabits,
      logs,
      goals,
      completionRate,
      streak,
      missedToday
    })
  };
}

module.exports = {
  summarizeHabits,
  isScheduled
};
