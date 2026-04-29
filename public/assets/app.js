const state = {
  user: null,
  habits: [],
  goals: [],
  insights: null,
  page: "today",
  scheduleDates: []
};

const todayKey = new Date().toISOString().slice(0, 10);
const toast = new bootstrap.Toast(document.querySelector("#appToast"));
const reminderKey = "habitpulse:reminder";
const celebratedKey = "habitpulse:celebrated";
const dayCelebratedKey = "habitpulse:day-celebrated";
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
    String(habit.frequencyDays || "")
      .split(",")
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

function exactDates(habit) {
  return new Set(
    String(habit.scheduleDates || "")
      .split(",")
      .map((date) => date.trim())
      .filter(Boolean)
  );
}

function isScheduled(habit, dateKey = todayKey) {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return habitDays(habit).has(day) || exactDates(habit).has(dateKey);
}

function frequencyText(habit) {
  const days = Array.from(habitDays(habit)).sort((a, b) => a - b);
  const dates = Array.from(exactDates(habit)).sort();
  let label = "No recurring days";

  if (days.length === 7) label = "Every day";
  else if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) label = "Weekdays";
  else if (days.length) label = days.map((day) => dayNames[day]).join(", ");

  if (dates.length && !days.length) return `${dates.length} specific date${dates.length === 1 ? "" : "s"}`;
  if (dates.length) return `${label} + ${dates.length} date${dates.length === 1 ? "" : "s"}`;
  return label;
}

function todoStats(habit, dateKey = todayKey) {
  const todos = habit.subHabits || [];
  const completed = todos.filter((todo) => todo.logs?.some((log) => log.date === dateKey && log.value > 0)).length;
  return {
    total: todos.length,
    completed,
    percent: todos.length ? Math.round((completed / todos.length) * 100) : 0
  };
}

function habitStatus(habit, dateKey = todayKey) {
  if (!isScheduled(habit, dateKey)) return "rest";
  const log = getTodayLog(habit);
  if (log?.value === 0) return "not-done";
  const todos = todoStats(habit, dateKey);
  if (todos.total && todos.completed === todos.total) return "complete";
  if (todos.completed > 0 || log?.value > 0) return "started";
  return "open";
}

function showCelebration(title, body) {
  document.querySelector("#celebrationTitle").textContent = title;
  document.querySelector("#celebrationBody").textContent = body;
  bootstrap.Modal.getOrCreateInstance(document.querySelector("#celebrationModal")).show();
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
  document.querySelector("#heroTitle").textContent = `Hey ${state.user?.name?.split(" ")[0] || "there"}, build today's flow.`;
}

function renderStats() {
  const stats = state.insights?.stats || {};
  const items = [
    { label: "Scheduled today", value: stats.scheduledToday || 0, icon: "calendar-check", tone: "blue" },
    { label: "Work done", value: `${stats.todayWorkDone || 0}/${stats.todayWorkTotal || 0}`, icon: "check2-circle", tone: "green" },
    { label: "Not done", value: stats.missedToday || 0, icon: "x-circle", tone: "red" },
    { label: "Streak", value: `${stats.streak || 0}d`, icon: "fire", tone: "amber" }
  ];

  document.querySelector("#completionRate").textContent = `${stats.completionRate || 0}%`;
  document.querySelector("#heroSub").textContent =
    stats.scheduledToday > 0
      ? `${stats.todayWorkDone || 0} of ${stats.todayWorkTotal || 0} scheduled work blocks complete.`
      : "No habits scheduled today. Rest days stay clean.";

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
            <button class="todo-block ${done ? "done" : ""}" data-habit-id="${habit.id}" data-sub-id="${todo.id}" data-done="${done}">
              <i class="bi ${done ? "bi-check-circle-fill" : "bi-circle"}"></i>
              <span>${escapeHtml(todo.title)}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHabitCard(habit, { manage = false } = {}) {
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
  const progress = todos.total ? todos.percent : scheduled && status !== "open" ? 100 : 0;

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
        ${
          manage
            ? `
              <div class="dropdown">
                <button class="btn btn-light icon-btn" data-bs-toggle="dropdown" aria-label="Habit actions">
                  <i class="bi bi-three-dots"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><button class="dropdown-item edit-habit" data-id="${habit.id}">Edit habit</button></li>
                  <li><button class="dropdown-item add-subhabit" data-id="${habit.id}">Add To do</button></li>
                  <li><button class="dropdown-item archive-habit" data-id="${habit.id}">Archive</button></li>
                  <li><button class="dropdown-item text-danger delete-habit" data-id="${habit.id}">Delete</button></li>
                </ul>
              </div>
            `
            : ""
        }
      </div>
      <div class="habit-progress-row">
        <span class="status-pill status-${status}">${escapeHtml(statusText)}</span>
        <span class="text-secondary small">${todos.completed}/${todos.total || 0} To do's</span>
      </div>
      <div class="mini-progress" aria-hidden="true"><span style="width:${progress}%"></span></div>
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

  todayList.innerHTML = todayHabits.length
    ? todayHabits.map((habit) => renderHabitCard(habit, { manage: false })).join("")
    : `<div class="empty-state"><i class="bi bi-calendar-heart fs-3 d-block mb-2"></i>No habits scheduled today.</div>`;

  allList.innerHTML = activeHabits.length
    ? activeHabits.map((habit) => renderHabitCard(habit, { manage: true })).join("")
    : `<div class="empty-state"><i class="bi bi-stars fs-3 d-block mb-2"></i>Add your first habit.</div>`;
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
      const percent = day.workTotal ? Math.min(100, day.workPercent) : 0;
      const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
      return `
        <div class="bar-wrap">
          <div class="bar-stack" title="${day.workDone}/${day.workTotal} work blocks">
            <div class="bar bar-water" style="height:${percent}%"></div>
          </div>
          <small class="text-secondary fw-semibold">${escapeHtml(label)}</small>
        </div>
      `;
    })
    .join("");
}

function renderMonthly() {
  const monthly = state.insights?.monthly || [];
  const activeDays = monthly.filter((day) => day.workDone > 0).length;
  const firstDate = monthly[0] ? new Date(`${monthly[0].date}T00:00:00`) : new Date();
  const firstDay = monthly[0] ? firstDate.getDay() : 0;
  const monthName = firstDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  document.querySelector("#monthLabel").textContent = monthName;
  document.querySelector("#monthlySummary").textContent = `${activeDays} active day${activeDays === 1 ? "" : "s"}`;

  const blanks = Array.from({ length: firstDay }, () => `<span class="calendar-cell calendar-blank"></span>`);
  const cells = monthly.map((day) => {
    const date = new Date(`${day.date}T00:00:00`);
    const dayNumber = date.getDate();
    const percent = day.workTotal ? Math.min(100, day.workPercent) : 0;
    const isFull = day.workTotal > 0 && percent === 100;

    return `
      <article class="calendar-cell ${day.workTotal ? "has-work" : "no-work"} ${isFull ? "is-full" : ""}">
        ${percent > 0 ? `<div class="water-fill" style="height:${percent}%"></div>` : ""}
        <div class="calendar-date">
          <span>${dayNumber}</span>
          <small>${escapeHtml(dayNames[date.getDay()])}</small>
        </div>
        <div class="calendar-metric">
          <strong>${percent > 0 ? `${percent}%` : ""}</strong>
          <span>${day.workTotal ? `${day.workDone}/${day.workTotal} work` : "Rest"}</span>
        </div>
        <div class="todo-checks">
          <i class="bi ${isFull ? "bi-check-circle-fill" : "bi-circle"}"></i>
          <span>${day.subCompleted}/${day.todoTotal || 0} To do's</span>
        </div>
      </article>
    `;
  });

  document.querySelector("#monthlyCalendar").innerHTML = [...blanks, ...cells].join("");
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
  if (!state.user || !state.insights?.milestones?.milestones) return false;
  const storage = JSON.parse(localStorage.getItem(celebratedKey) || "{}");
  const userKey = state.user.id || state.user.email || "local";
  const seen = new Set(storage[userKey] || []);
  const newMilestone = state.insights.milestones.milestones.find(
    (milestone) => milestone.achieved && !seen.has(milestone.title)
  );
  if (!newMilestone) return false;
  seen.add(newMilestone.title);
  storage[userKey] = Array.from(seen);
  localStorage.setItem(celebratedKey, JSON.stringify(storage));
  showCelebration(`Congrats: ${newMilestone.title}`, newMilestone.body);
  return true;
}

function showDailyCompletion() {
  const stats = state.insights?.stats;
  if (!state.user || !stats?.dayComplete) return false;
  const key = `${state.user.id || state.user.email || "local"}:${todayKey}`;
  const seen = new Set(JSON.parse(localStorage.getItem(dayCelebratedKey) || "[]"));
  if (seen.has(key)) return false;
  seen.add(key);
  localStorage.setItem(dayCelebratedKey, JSON.stringify(Array.from(seen)));
  showCelebration("Day complete", "Congratulations. Every scheduled work block for today is done.");
  return true;
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
  if (!showDailyCompletion()) {
    showNewMilestones();
  }
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
  return Array.from(document.querySelectorAll("#frequencyPicker input:checked"))
    .map((input) => input.value)
    .join(",");
}

function selectedScheduleDates() {
  return state.scheduleDates.slice().sort().join(",");
}

function setFrequencyPicker(value = "1,2,3,4,5") {
  const selected = new Set(String(value || "").split(",").filter(Boolean));
  document.querySelectorAll("#frequencyPicker input").forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function renderScheduleDateChips() {
  const container = document.querySelector("#scheduleDateChips");
  container.innerHTML = state.scheduleDates.length
    ? state.scheduleDates
        .slice()
        .sort()
        .map(
          (date) => `
            <button class="date-chip" type="button" data-date="${date}">
              <span>${escapeHtml(date)}</span>
              <i class="bi bi-x"></i>
            </button>
          `
        )
        .join("")
    : `<span class="text-secondary small">No specific dates selected</span>`;
}

function resetHabitForm() {
  document.querySelector("#habitForm").reset();
  document.querySelector("#habitId").value = "";
  document.querySelector("#habitModalTitle").textContent = "New habit";
  document.querySelector("#habitSubmit").textContent = "Create";
  document.querySelector("#habitCategory").value = "Lifestyle";
  document.querySelector("#habitColor").value = "#111827";
  document.querySelector("#habitSubHabits").placeholder = "Warm up\nMain sets\nStretch";
  state.scheduleDates = [];
  setFrequencyPicker("1,2,3,4,5");
  renderScheduleDateChips();
}

function openEditHabit(habit) {
  document.querySelector("#habitId").value = habit.id;
  document.querySelector("#habitTitle").value = habit.title;
  document.querySelector("#habitCategory").value = habit.category;
  document.querySelector("#habitIcon").value = habit.icon;
  document.querySelector("#habitColor").value = habit.color;
  document.querySelector("#habitSubHabits").value = "";
  document.querySelector("#habitSubHabits").placeholder = "Add new To do's only";
  document.querySelector("#habitModalTitle").textContent = "Edit habit";
  document.querySelector("#habitSubmit").textContent = "Save";
  state.scheduleDates = Array.from(exactDates(habit));
  setFrequencyPicker(habit.frequencyDays || "");
  renderScheduleDateChips();
  bootstrap.Modal.getOrCreateInstance(document.querySelector("#habitModal")).show();
}

async function saveNewTodos(habitId, titles) {
  await Promise.all(
    titles.map((title) =>
      api(`/api/habits/${habitId}/subhabits`, {
        method: "POST",
        body: JSON.stringify({ title })
      })
    )
  );
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

document.querySelectorAll('[data-bs-target="#habitModal"]').forEach((button) => {
  button.addEventListener("click", resetHabitForm);
});

document.querySelector("#themeToggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.querySelector("#addScheduleDate").addEventListener("click", () => {
  const input = document.querySelector("#scheduleDateInput");
  if (!input.value) return;
  state.scheduleDates = Array.from(new Set([...state.scheduleDates, input.value]));
  input.value = "";
  renderScheduleDateChips();
});

document.querySelector("#scheduleDateChips").addEventListener("click", (event) => {
  const chip = event.target.closest(".date-chip");
  if (!chip) return;
  state.scheduleDates = state.scheduleDates.filter((date) => date !== chip.dataset.date);
  renderScheduleDateChips();
});

document.querySelector("#habitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const habitId = document.querySelector("#habitId").value;
  const newTodos = document
    .querySelector("#habitSubHabits")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const frequencyDays = selectedFrequencyDays();
  const scheduleDates = selectedScheduleDates();
  const payload = {
    title: document.querySelector("#habitTitle").value,
    category: document.querySelector("#habitCategory").value,
    cadence: "WEEKLY",
    targetPerPeriod: Math.max(1, frequencyDays.split(",").filter(Boolean).length || state.scheduleDates.length || 1),
    frequencyDays,
    scheduleDates,
    color: document.querySelector("#habitColor").value,
    icon: document.querySelector("#habitIcon").value
  };

  if (habitId) {
    await api(`/api/habits/${habitId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    if (newTodos.length) {
      await saveNewTodos(habitId, newTodos);
    }
    showToast("Habit updated");
  } else {
    await api("/api/habits", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        subHabits: newTodos
      })
    });
    showToast("Habit created");
  }

  bootstrap.Modal.getInstance(document.querySelector("#habitModal")).hide();
  resetHabitForm();
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
  const editHabitButton = event.target.closest(".edit-habit");
  const todoToggle = event.target.closest(".todo-block");
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

  if (editHabitButton) {
    const habit = state.habits.find((item) => item.id === editHabitButton.dataset.id);
    if (habit) openEditHabit(habit);
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

  if (todoToggle && !event.target.closest(".dropdown")) {
    const value = todoToggle.dataset.done === "true" ? 0 : 1;
    await api(`/api/habits/${todoToggle.dataset.habitId}/subhabits/${todoToggle.dataset.subId}/logs`, {
      method: "POST",
      body: JSON.stringify({ date: todayKey, value })
    });
    showToast(value ? "To do complete" : "To do reopened");
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
resetHabitForm();
hydrateReminderForm();
setInterval(checkReminder, 30000);
setPage("today");

refresh().catch((error) => {
  showToast(error.message || "Unable to load dashboard");
});
