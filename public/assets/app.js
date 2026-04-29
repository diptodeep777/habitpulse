const state = {
  user: null,
  habits: [],
  goals: [],
  insights: null,
  page: "today"
};

const todayKey = new Date().toISOString().slice(0, 10);
const toast = new bootstrap.Toast(document.querySelector("#appToast"));
const reminderKey = "habitpulse:reminder";
const celebratedKey = "habitpulse:celebrated";
const themeKey = "habitpulse:theme";
const pageMeta = {
  today: ["Today", "Daily command center"],
  habits: ["Habits", "Habit library"],
  progress: ["Progress", "Monthly calendar"],
  goals: ["Goals", "Targets and milestones"],
  profile: ["Profile", "Account analytics"],
  reminders: ["Reminders", "Daily notification"]
};
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconClass(name) {
  return `bi bi-${String(name || "sparkles").replace(/[^a-z0-9-]/gi, "")}`;
}

function showToast(message) {
  document.querySelector("#toastBody").textContent = message;
  toast.show();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 401) {
    window.location.href = "/";
    return null;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Request failed.");
  }

  if (response.status === 204) return null;
  return response.json();
}

function getTodayLog(habit) {
  return habit.logs?.find((log) => log.date === todayKey);
}

function habitDays(habit) {
  return new Set(
    String(habit.frequencyDays || "0,1,2,3,4,5,6")
      .split(",")
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day))
  );
}

function isScheduled(habit, dateKey = todayKey) {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return habitDays(habit).has(day);
}

function frequencyText(habit) {
  const days = Array.from(habitDays(habit)).sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) return "Weekdays";
  if (!days.length) return "No days";
  return days.map((day) => dayNames[day]).join(", ");
}

function todoStats(habit) {
  const todos = habit.subHabits || [];
  const completed = todos.filter((todo) => todo.logs?.some((log) => log.date === todayKey && log.value > 0)).length;
  return {
    total: todos.length,
    completed,
    percent: todos.length ? Math.round((completed / todos.length) * 100) : 0
  };
}

function habitStatus(habit) {
  if (!isScheduled(habit)) return "rest";
  const log = getTodayLog(habit);
  if (log?.value === 0) return "not-done";
  const todos = todoStats(habit);
  if (todos.total && todos.completed === todos.total) return "complete";
  if (todos.completed > 0 || log?.value > 0) return "started";
  return "open";
}

function setPage(page) {
  state.page = page;
  const meta = pageMeta[page] || pageMeta.today;
  document.querySelector("#pageEyebrow").textContent = meta[0];
  document.querySelector("#pageTitle").textContent = meta[1];
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });
  document.querySelectorAll("[data-page-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.pagePanel === page);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(themeKey, theme);
  document.querySelector("#themeToggle i").className =
    theme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
}

function renderUser() {
  const initial = state.user?.name?.charAt(0)?.toUpperCase() || "U";
  document.querySelector("#avatarInitial").textContent = initial;
  document.querySelector("#accountName").textContent = state.user?.name || "Account";
  document.querySelector("#heroTitle").textContent = `Hey ${state.user?.name?.split(" ")[0] || "there"}, today is scheduled cleanly.`;
}

function renderStats() {
  const stats = state.insights?.stats || {};
  const items = [
    { label: "Scheduled today", value: stats.scheduledToday || 0, icon: "calendar-check", tone: "blue" },
    { label: "Checked in", value: stats.checkedToday || 0, icon: "check2-circle", tone: "green" },
    { label: "Not done", value: stats.missedToday || 0, icon: "x-circle", tone: "red" },
    { label: "Streak", value: `${stats.streak || 0}d`, icon: "fire", tone: "amber" }
  ];

  document.querySelector("#completionRate").textContent = `${stats.completionRate || 0}%`;
  document.querySelector("#heroSub").textContent =
    stats.scheduledToday > 0
      ? `${stats.checkedToday || 0} of ${stats.scheduledToday} scheduled habits checked in.`
      : "No habits scheduled today. Your progress will not be marked incomplete.";

  document.querySelector("#statsGrid").innerHTML = items
    .map(
      (item) => `
        <div class="col-6 col-xl-3">
          <article class="stat-card tone-${item.tone}">
            <span class="stat-icon mb-3"><i class="bi bi-${item.icon}"></i></span>
            <div class="h3 fw-black mb-1">${escapeHtml(item.value)}</div>
            <div class="text-secondary fw-semibold">${escapeHtml(item.label)}</div>
          </article>
        </div>
      `
    )
    .join("");
}

function renderTodoBlocks(habit) {
  const todos = habit.subHabits || [];
  if (!todos.length) {
    return `<div class="empty-mini">No To do's yet</div>`;
  }

  return `
    <div class="todo-block-grid">
      ${todos
        .map((todo) => {
          const done = todo.logs?.some((log) => log.date === todayKey && log.value > 0);
          return `
            <article class="todo-block ${done ? "done" : ""}">
              <button class="todo-toggle" data-habit-id="${habit.id}" data-sub-id="${todo.id}" data-done="${done}" aria-label="Toggle To do">
                <i class="bi ${done ? "bi-check-lg" : "bi-circle"}"></i>
              </button>
              <span>${escapeHtml(todo.title)}</span>
              <button class="todo-delete" data-habit-id="${habit.id}" data-sub-id="${todo.id}" aria-label="Delete To do">
                <i class="bi bi-x"></i>
              </button>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHabitCard(habit) {
  const status = habitStatus(habit);
  const todos = todoStats(habit);
  const scheduled = isScheduled(habit);
  const statusText = {
    rest: "Rest day",
    complete: "All To do's done",
    started: "Checked in",
    "not-done": "Not done",
    open: "Open"
  }[status];

  return `
    <article class="habit-card habit-${status}">
      <div class="habit-card-top">
        <span class="habit-icon" style="background:${escapeHtml(habit.color)}">
          <i class="${iconClass(habit.icon)}"></i>
        </span>
        <div class="habit-title-wrap">
          <h3 class="h6 fw-bold mb-1">${escapeHtml(habit.title)}</h3>
          <p class="text-secondary small mb-0">${escapeHtml(habit.category)} · ${escapeHtml(frequencyText(habit))}</p>
        </div>
        <div class="dropdown">
          <button class="btn btn-light icon-btn" data-bs-toggle="dropdown" aria-label="Habit actions">
            <i class="bi bi-three-dots"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button class="dropdown-item add-subhabit" data-id="${habit.id}">Add To do</button></li>
            <li><button class="dropdown-item archive-habit" data-id="${habit.id}">Archive</button></li>
            <li><button class="dropdown-item text-danger delete-habit" data-id="${habit.id}">Delete</button></li>
          </ul>
        </div>
      </div>
      <div class="habit-progress-row">
        <span class="status-pill status-${status}">${escapeHtml(statusText)}</span>
        <span class="text-secondary small">${todos.completed}/${todos.total || 0} To do's</span>
      </div>
      <div class="mini-progress" aria-hidden="true"><span style="width:${todos.total ? todos.percent : scheduled && status !== "open" ? 100 : 0}%"></span></div>
      <p class="eyebrow mt-3 mb-2">To do's</p>
      ${renderTodoBlocks(habit)}
      <div class="check-actions mt-3">
        ${
          scheduled
            ? `
              <button class="btn check-status done-action ${status === "complete" || status === "started" ? "active" : ""}" data-id="${habit.id}" data-status="done">
                <i class="bi bi-check2-circle"></i> Done
              </button>
              <button class="btn check-status miss-action ${status === "not-done" ? "active" : ""}" data-id="${habit.id}" data-status="not-done">
                <i class="bi bi-x-circle"></i> Not done
              </button>
            `
            : `<button class="btn btn-light w-100" disabled><i class="bi bi-moon-stars"></i> Not scheduled today</button>`
        }
      </div>
      ${
        scheduled && status !== "open"
          ? `<button class="btn btn-link btn-sm clear-check px-0 mt-2" data-id="${habit.id}">Clear today's mark</button>`
          : ""
      }
    </article>
  `;
}

function renderHabits() {
  const activeHabits = state.habits.filter((habit) => !habit.archived);
  const todayHabits = activeHabits.filter((habit) => isScheduled(habit));
  const todayList = document.querySelector("#todayHabitList");
  const allList = document.querySelector("#habitList");
  const empty = `
    <div class="empty-state">
      <i class="bi bi-stars fs-3 d-block mb-2"></i>
      Add your first habit.
    </div>
  `;

  todayList.innerHTML = todayHabits.length
    ? todayHabits.map(renderHabitCard).join("")
    : `<div class="empty-state"><i class="bi bi-calendar-heart fs-3 d-block mb-2"></i>No habits scheduled today.</div>`;

  allList.innerHTML = activeHabits.length ? activeHabits.map(renderHabitCard).join("") : empty;
}

function renderSuggestions() {
  const suggestions = state.insights?.suggestions || [];
  document.querySelector("#suggestionsList").innerHTML = suggestions
    .map(
      (suggestion) => `
        <article class="suggestion-card suggestion-${escapeHtml(suggestion.tone)}">
          <span class="stat-icon"><i class="bi ${suggestion.tone === "ai" ? "bi-cpu" : "bi-lightning-charge"}"></i></span>
          <div>
            <h3 class="h6 fw-bold mb-1">${escapeHtml(suggestion.title)}</h3>
            <p class="text-secondary small mb-0">${escapeHtml(suggestion.body)}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderWeekly() {
  const weekly = state.insights?.weekly || [];
  document.querySelector("#weeklyChart").innerHTML = weekly
    .map((day) => {
      const habitPercent = day.target ? Math.min(100, Math.round((day.count / day.target) * 100)) : 100;
      const todoPercent = day.todoTotal ? Math.min(100, Math.round((day.subCompleted / day.todoTotal) * 100)) : 100;
      const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
      return `
        <div class="bar-wrap">
          <div class="bar-stack" title="${day.count}/${day.target} habits, ${day.subCompleted}/${day.todoTotal} To do's">
            <div class="bar bar-done" style="height:${Math.max(habitPercent, 5)}%"></div>
            <div class="bar bar-todo" style="height:${Math.max(todoPercent, 5)}%"></div>
          </div>
          <small class="text-secondary fw-semibold">${escapeHtml(label)}</small>
        </div>
      `;
    })
    .join("");
}

function renderMonthly() {
  const monthly = state.insights?.monthly || [];
  const activeDays = monthly.filter((day) => day.count > 0 || day.subCompleted > 0).length;
  document.querySelector("#monthlySummary").textContent = `${activeDays} active day${activeDays === 1 ? "" : "s"}`;

  document.querySelector("#monthlyCalendar").innerHTML = monthly
    .map((day) => {
      const date = new Date(`${day.date}T00:00:00`);
      const dayNumber = date.getDate();
      const habitPercent = day.target ? Math.min(100, day.habitPercent) : 100;
      const todoPercent = day.todoTotal ? Math.min(100, day.todoPercent) : 100;
      const done = day.target && day.count >= day.target;
      return `
        <article class="calendar-cell ${done ? "is-full" : ""}">
          <div class="calendar-date">
            <span>${dayNumber}</span>
            <small>${escapeHtml(dayNames[date.getDay()])}</small>
          </div>
          <div class="calendar-metric">
            <strong>${habitPercent}%</strong>
            <span>Habits</span>
          </div>
          <div class="todo-checks">
            <i class="bi ${todoPercent === 100 ? "bi-check-circle-fill" : "bi-circle"}"></i>
            <span>${day.subCompleted}/${day.todoTotal || 0}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTodoProgress() {
  const habitsWithTodos = state.habits.filter((habit) => !habit.archived && habit.subHabits?.length);
  document.querySelector("#todoProgressList").innerHTML = habitsWithTodos.length
    ? habitsWithTodos
        .map((habit) => {
          const todos = todoStats(habit);
          return `
            <article class="todo-progress-card">
              <div class="d-flex justify-content-between gap-3 mb-2">
                <strong>${escapeHtml(habit.title)}</strong>
                <span>${todos.percent}%</span>
              </div>
              <div class="mini-progress"><span style="width:${todos.percent}%"></span></div>
              <div class="todo-checkline mt-3">
                ${(habit.subHabits || [])
                  .map((todo) => {
                    const done = todo.logs?.some((log) => log.date === todayKey && log.value > 0);
                    return `<span class="${done ? "done" : ""}"><i class="bi ${done ? "bi-check-lg" : "bi-x"}"></i>${escapeHtml(todo.title)}</span>`;
                  })
                  .join("")}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">Add To do's inside habits to see work-item progress.</div>`;
}

function renderMilestones() {
  const milestones = state.insights?.milestones?.milestones || [];
  document.querySelector("#milestoneList").innerHTML = milestones
    .map(
      (milestone) => `
        <article class="milestone-card ${milestone.achieved ? "is-achieved" : ""}">
          <span class="stat-icon"><i class="bi bi-${escapeHtml(milestone.icon)}"></i></span>
          <div>
            <h3 class="h6 fw-bold mb-1">${escapeHtml(milestone.title)}</h3>
            <p class="text-secondary small mb-0">${escapeHtml(milestone.body)}</p>
          </div>
          <i class="bi ${milestone.achieved ? "bi-check-circle-fill" : "bi-circle"} ms-auto"></i>
        </article>
      `
    )
    .join("");
}

function renderGoals() {
  const container = document.querySelector("#goalList");
  if (!state.goals.length) {
    container.innerHTML = `<div class="empty-state"><i class="bi bi-bullseye fs-3 d-block mb-2"></i>Add a goal.</div>`;
    return;
  }

  container.innerHTML = state.goals
    .map((goal) => {
      const progress = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
      return `
        <article class="goal-card ${goal.status === "COMPLETED" ? "is-complete" : ""}">
          <div class="d-flex justify-content-between gap-2 mb-2">
            <div>
              <span class="badge text-bg-light">${escapeHtml(goal.horizon.toLowerCase())}</span>
              <h3 class="h6 fw-bold mt-2 mb-1">${escapeHtml(goal.title)}</h3>
            </div>
            <button class="btn btn-light icon-btn delete-goal" data-id="${goal.id}" aria-label="Delete goal"><i class="bi bi-trash"></i></button>
          </div>
          <div class="d-flex justify-content-between small text-secondary mb-2">
            <span>${goal.currentValue} / ${goal.targetValue} ${escapeHtml(goal.unit)}</span>
            <span>${progress}%</span>
          </div>
          <div class="mini-progress mb-3"><span style="width:${progress}%"></span></div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-dark btn-sm flex-fill increment-goal" data-id="${goal.id}" data-current="${goal.currentValue}">
              <i class="bi bi-plus-lg"></i> 1
            </button>
            <button class="btn btn-dark btn-sm flex-fill complete-goal" data-id="${goal.id}" data-target="${goal.targetValue}">
              <i class="bi bi-check2"></i> Complete
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderProfile() {
  const stats = state.insights?.stats || {};
  const topHabits = state.insights?.topHabits || [];
  const categories = state.insights?.categories || [];
  const next = state.insights?.milestones?.next;

  document.querySelector("#profilePanel").innerHTML = `
    <div class="profile-grid">
      <article class="profile-card profile-hero">
        <span class="avatar-large">${escapeHtml(state.user?.name?.charAt(0)?.toUpperCase() || "U")}</span>
        <div>
          <h2 class="h4 fw-black mb-1">${escapeHtml(state.user?.name || "User")}</h2>
          <p class="text-secondary mb-0">${escapeHtml(state.user?.email || "")}</p>
        </div>
      </article>
      <article class="profile-card"><p class="eyebrow mb-2">Monthly pulse</p><div class="h2 fw-black mb-1">${stats.completionRate || 0}%</div><p class="text-secondary mb-0">Scheduled-day consistency</p></article>
      <article class="profile-card"><p class="eyebrow mb-2">To do's</p><div class="h2 fw-black mb-1">${stats.subHabits || 0}</div><p class="text-secondary mb-0">Work blocks inside habits</p></article>
      <article class="profile-card profile-wide">
        <p class="eyebrow mb-2">Top habits</p>
        ${
          topHabits.length
            ? topHabits.map((habit) => `<div class="analytics-row"><span>${escapeHtml(habit.title)}</span><strong>${habit.completions}</strong></div>`).join("")
            : `<p class="text-secondary mb-0">Complete habits to unlock rankings.</p>`
        }
      </article>
      <article class="profile-card profile-wide">
        <p class="eyebrow mb-2">Categories</p>
        ${
          categories.length
            ? categories.map((category) => `<div class="analytics-row"><span>${escapeHtml(category.category)}</span><strong>${category.completions}</strong></div>`).join("")
            : `<p class="text-secondary mb-0">Add habits to see category analytics.</p>`
        }
      </article>
      <article class="profile-card profile-wide">
        <p class="eyebrow mb-2">Next milestone</p>
        <h3 class="h6 fw-bold mb-1">${escapeHtml(next?.title || "First spark")}</h3>
        <p class="text-secondary mb-0">${escapeHtml(next?.body || "Complete your first habit check-in.")}</p>
      </article>
    </div>
  `;
}

function showNewMilestones() {
  if (!state.user || !state.insights?.milestones?.milestones) return;
  const storage = JSON.parse(localStorage.getItem(celebratedKey) || "{}");
  const userKey = state.user.id || state.user.email || "local";
  const seen = new Set(storage[userKey] || []);
  const newMilestone = state.insights.milestones.milestones.find(
    (milestone) => milestone.achieved && !seen.has(milestone.title)
  );
  if (!newMilestone) return;
  seen.add(newMilestone.title);
  storage[userKey] = Array.from(seen);
  localStorage.setItem(celebratedKey, JSON.stringify(storage));
  document.querySelector("#celebrationTitle").textContent = `Congrats: ${newMilestone.title}`;
  document.querySelector("#celebrationBody").textContent = newMilestone.body;
  bootstrap.Modal.getOrCreateInstance(document.querySelector("#celebrationModal")).show();
}

function renderAll() {
  renderUser();
  renderStats();
  renderHabits();
  renderSuggestions();
  renderWeekly();
  renderMonthly();
  renderTodoProgress();
  renderMilestones();
  renderGoals();
  renderProfile();
  showNewMilestones();
}

async function refresh() {
  const [{ user }, { habits }, { goals }, insights] = await Promise.all([
    api("/api/auth/me"),
    api("/api/habits"),
    api("/api/goals"),
    api("/api/insights/summary")
  ]);

  state.user = user;
  state.habits = habits;
  state.goals = goals;
  state.insights = insights;
  renderAll();
}

function selectedFrequencyDays() {
  const days = Array.from(document.querySelectorAll("#frequencyPicker input:checked")).map((input) => input.value);
  return days.length ? days.join(",") : "1,2,3,4,5";
}

function loadReminderSettings() {
  return JSON.parse(localStorage.getItem(reminderKey) || '{"enabled":false,"time":"20:00","lastShown":""}');
}

function saveReminderSettings(settings) {
  localStorage.setItem(reminderKey, JSON.stringify(settings));
}

function hydrateReminderForm() {
  const settings = loadReminderSettings();
  document.querySelector("#reminderEnabled").checked = Boolean(settings.enabled);
  document.querySelector("#reminderTime").value = settings.time || "20:00";
}

function checkReminder() {
  const settings = loadReminderSettings();
  if (!settings.enabled) return;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().slice(0, 10);
  if (settings.time !== currentTime || settings.lastShown === currentDate) return;
  settings.lastShown = currentDate;
  saveReminderSettings(settings);
  const message = "Time to log today's HabitPulse entry.";
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("HabitPulse reminder", { body: message });
  } else {
    showToast(message);
  }
}

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => setPage(button.dataset.page));
});

document.querySelectorAll("[data-page-jump]").forEach((button) => {
  button.addEventListener("click", () => setPage(button.dataset.pageJump));
});

document.querySelector("#themeToggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.querySelector("#habitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const subHabits = document
    .querySelector("#habitSubHabits")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  await api("/api/habits", {
    method: "POST",
    body: JSON.stringify({
      title: document.querySelector("#habitTitle").value,
      category: document.querySelector("#habitCategory").value,
      cadence: "WEEKLY",
      targetPerPeriod: selectedFrequencyDays().split(",").length,
      frequencyDays: selectedFrequencyDays(),
      color: document.querySelector("#habitColor").value,
      icon: document.querySelector("#habitIcon").value,
      subHabits
    })
  });

  bootstrap.Modal.getInstance(document.querySelector("#habitModal")).hide();
  event.target.reset();
  document.querySelector("#habitCategory").value = "Lifestyle";
  document.querySelector("#habitColor").value = "#111827";
  document.querySelectorAll("#frequencyPicker input").forEach((input) => {
    input.checked = ["1", "2", "3", "4", "5"].includes(input.value);
  });
  showToast("Habit created");
  await refresh();
});

document.querySelector("#goalForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/goals", {
    method: "POST",
    body: JSON.stringify({
      title: document.querySelector("#goalTitle").value,
      horizon: document.querySelector("#goalHorizon").value,
      targetValue: Number(document.querySelector("#goalTarget").value),
      unit: document.querySelector("#goalUnit").value,
      dueDate: document.querySelector("#goalDue").value || null
    })
  });

  bootstrap.Modal.getInstance(document.querySelector("#goalModal")).hide();
  event.target.reset();
  document.querySelector("#goalTarget").value = "10";
  document.querySelector("#goalUnit").value = "times";
  showToast("Goal created");
  await refresh();
});

document.querySelector("#reminderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const enabled = document.querySelector("#reminderEnabled").checked;
  if (enabled && "Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  saveReminderSettings({
    enabled,
    time: document.querySelector("#reminderTime").value || "20:00",
    lastShown: loadReminderSettings().lastShown || ""
  });
  showToast(enabled ? "Daily reminder saved" : "Daily reminder turned off");
});

document.addEventListener("click", async (event) => {
  const statusButton = event.target.closest(".check-status");
  const clearButton = event.target.closest(".clear-check");
  const archiveButton = event.target.closest(".archive-habit");
  const deleteHabitButton = event.target.closest(".delete-habit");
  const addSubHabitButton = event.target.closest(".add-subhabit");
  const todoToggle = event.target.closest(".todo-toggle");
  const todoDelete = event.target.closest(".todo-delete");
  const deleteGoalButton = event.target.closest(".delete-goal");
  const incrementGoalButton = event.target.closest(".increment-goal");
  const completeGoalButton = event.target.closest(".complete-goal");

  if (statusButton) {
    const value = statusButton.dataset.status === "done" ? 1 : 0;
    await api(`/api/habits/${statusButton.dataset.id}/logs`, {
      method: "POST",
      body: JSON.stringify({ date: todayKey, value })
    });
    showToast(value ? "Marked done" : "Marked not done");
    await refresh();
  }

  if (clearButton) {
    await api(`/api/habits/${clearButton.dataset.id}/logs/${todayKey}`, { method: "DELETE" });
    showToast("Today's mark cleared");
    await refresh();
  }

  if (addSubHabitButton) {
    const title = window.prompt("To do name");
    if (title?.trim()) {
      await api(`/api/habits/${addSubHabitButton.dataset.id}/subhabits`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim() })
      });
      showToast("To do added");
      await refresh();
    }
  }

  if (todoToggle) {
    const value = todoToggle.dataset.done === "true" ? 0 : 1;
    await api(`/api/habits/${todoToggle.dataset.habitId}/subhabits/${todoToggle.dataset.subId}/logs`, {
      method: "POST",
      body: JSON.stringify({ date: todayKey, value })
    });
    showToast(value ? "To do complete" : "To do reopened");
    await refresh();
  }

  if (todoDelete) {
    await api(`/api/habits/${todoDelete.dataset.habitId}/subhabits/${todoDelete.dataset.subId}`, {
      method: "DELETE"
    });
    showToast("To do deleted");
    await refresh();
  }

  if (archiveButton) {
    await api(`/api/habits/${archiveButton.dataset.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true })
    });
    showToast("Habit archived");
    await refresh();
  }

  if (deleteHabitButton) {
    await api(`/api/habits/${deleteHabitButton.dataset.id}`, { method: "DELETE" });
    showToast("Habit deleted");
    await refresh();
  }

  if (deleteGoalButton) {
    await api(`/api/goals/${deleteGoalButton.dataset.id}`, { method: "DELETE" });
    showToast("Goal deleted");
    await refresh();
  }

  if (incrementGoalButton) {
    await api(`/api/goals/${incrementGoalButton.dataset.id}`, {
      method: "PATCH",
      body: JSON.stringify({ currentValue: Number(incrementGoalButton.dataset.current) + 1 })
    });
    showToast("Goal updated");
    await refresh();
  }

  if (completeGoalButton) {
    await api(`/api/goals/${completeGoalButton.dataset.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        currentValue: Number(completeGoalButton.dataset.target),
        status: "COMPLETED"
      })
    });
    showToast("Goal completed");
    await refresh();
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
});

setTheme(localStorage.getItem(themeKey) || "light");
hydrateReminderForm();
setInterval(checkReminder, 30000);
setPage("today");

refresh().catch((error) => {
  showToast(error.message || "Unable to load dashboard");
});
