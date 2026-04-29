const state = {
  user: null,
  habits: [],
  goals: [],
  insights: null
};

const todayKey = new Date().toISOString().slice(0, 10);
const toast = new bootstrap.Toast(document.querySelector("#appToast"));
const reminderKey = "habitpulse:reminder";
const celebratedKey = "habitpulse:celebrated";

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

function statusLabel(log) {
  if (!log) return "open";
  return log.value > 0 ? "done" : "not-done";
}

function renderUser() {
  const initial = state.user?.name?.charAt(0)?.toUpperCase() || "U";
  document.querySelector("#avatarInitial").textContent = initial;
  document.querySelector("#accountName").textContent = state.user?.name || "Account";
  document.querySelector("#heroTitle").textContent = `Hey ${state.user?.name?.split(" ")[0] || "there"}, keep the streak alive.`;
}

function renderStats() {
  const stats = state.insights?.stats || {};
  const items = [
    { label: "Active habits", value: stats.activeHabits || 0, icon: "stars", color: "#d8ff65" },
    { label: "Done today", value: stats.checkedToday || 0, icon: "check2-circle", color: "#5ee6a8" },
    { label: "Not done", value: stats.missedToday || 0, icon: "x-circle", color: "#ff8a8a" },
    { label: "Current streak", value: `${stats.streak || 0}d`, icon: "fire", color: "#ffb86b" }
  ];

  document.querySelector("#completionRate").textContent = `${stats.completionRate || 0}%`;
  document.querySelector("#heroSub").textContent =
    stats.checkedToday > 0
      ? `You have completed ${stats.checkedToday} action${stats.checkedToday === 1 ? "" : "s"} today.`
      : "Start with one tiny action and let the dashboard compound.";

  document.querySelector("#statsGrid").innerHTML = items
    .map(
      (item) => `
        <div class="col-6 col-xl-3">
          <article class="stat-card motion-fade">
            <span class="stat-icon mb-3" style="background:${item.color}">
              <i class="bi bi-${item.icon}"></i>
            </span>
            <div class="h3 fw-black mb-1">${escapeHtml(item.value)}</div>
            <div class="text-secondary fw-semibold">${escapeHtml(item.label)}</div>
          </article>
        </div>
      `
    )
    .join("");
}

function renderSubHabits(habit) {
  const subHabits = habit.subHabits || [];
  if (!subHabits.length) {
    return `<p class="text-secondary small mb-2">No sub-habits yet.</p>`;
  }

  return `
    <div class="subhabit-list">
      ${subHabits
        .map((subHabit) => {
          const done = subHabit.logs?.some((log) => log.date === todayKey && log.value > 0);
          return `
            <div class="subhabit-row ${done ? "is-complete" : ""}">
              <button class="subhabit-toggle" data-habit-id="${habit.id}" data-sub-id="${subHabit.id}" data-done="${done}" aria-label="Toggle sub-habit">
                <i class="bi ${done ? "bi-check2" : "bi-circle"}"></i>
              </button>
              <span>${escapeHtml(subHabit.title)}</span>
              <button class="subhabit-delete" data-habit-id="${habit.id}" data-sub-id="${subHabit.id}" aria-label="Delete sub-habit">
                <i class="bi bi-x"></i>
              </button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHabits() {
  const activeHabits = state.habits.filter((habit) => !habit.archived);
  const container = document.querySelector("#habitList");

  if (!activeHabits.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-stars fs-3 d-block mb-2"></i>
        Add your first habit and make today count.
      </div>
    `;
    return;
  }

  container.innerHTML = activeHabits
    .map((habit) => {
      const log = getTodayLog(habit);
      const status = statusLabel(log);
      return `
        <article class="habit-card motion-fade habit-${status}">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
            <span class="habit-icon" style="background:${escapeHtml(habit.color)}">
              <i class="${iconClass(habit.icon)}"></i>
            </span>
            <div class="dropdown">
              <button class="btn btn-light icon-btn" data-bs-toggle="dropdown" aria-label="Habit actions">
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><button class="dropdown-item add-subhabit" data-id="${habit.id}">Add sub-habit</button></li>
                <li><button class="dropdown-item archive-habit" data-id="${habit.id}">Archive</button></li>
                <li><button class="dropdown-item text-danger delete-habit" data-id="${habit.id}">Delete</button></li>
              </ul>
            </div>
          </div>
          <h3 class="h6 fw-bold mb-1">${escapeHtml(habit.title)}</h3>
          <p class="text-secondary small mb-3">${escapeHtml(habit.category)} · ${escapeHtml(habit.cadence.toLowerCase())}</p>
          ${renderSubHabits(habit)}
          <div class="check-actions">
            <button class="btn check-status done-action ${status === "done" ? "active" : ""}" data-id="${habit.id}" data-status="done">
              <i class="bi bi-check2-circle"></i>
              Done
            </button>
            <button class="btn check-status miss-action ${status === "not-done" ? "active" : ""}" data-id="${habit.id}" data-status="not-done">
              <i class="bi bi-x-circle"></i>
              Not done
            </button>
          </div>
          ${
            status !== "open"
              ? `<button class="btn btn-link btn-sm clear-check px-0 mt-2" data-id="${habit.id}">Clear today's mark</button>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderSuggestions() {
  const suggestions = state.insights?.suggestions || [];
  const container = document.querySelector("#suggestionsList");

  container.innerHTML = suggestions
    .map(
      (suggestion) => `
        <article class="suggestion-card suggestion-${escapeHtml(suggestion.tone)}">
          <div class="d-flex gap-3">
            <span class="stat-icon">
              <i class="bi ${suggestion.tone === "ai" ? "bi-cpu" : "bi-lightning-charge"}"></i>
            </span>
            <div>
              <h3 class="h6 fw-bold mb-1">${escapeHtml(suggestion.title)}</h3>
              <p class="text-secondary small mb-0">${escapeHtml(suggestion.body)}</p>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderWeekly() {
  const weekly = state.insights?.weekly || [];
  const maxTarget = Math.max(...weekly.map((day) => day.target || 1), 1);

  document.querySelector("#weeklyChart").innerHTML = weekly
    .map((day) => {
      const donePercent = Math.min(100, Math.round((day.count / maxTarget) * 100));
      const missedPercent = Math.min(100, Math.round((day.missed / maxTarget) * 100));
      const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
      return `
        <div class="bar-wrap">
          <div class="bar-stack" title="${day.count} done, ${day.missed} not done">
            <div class="bar bar-done" style="height:${Math.max(donePercent, day.count ? 8 : 0)}%"></div>
            <div class="bar bar-missed" style="height:${Math.max(missedPercent, day.missed ? 8 : 0)}%"></div>
          </div>
          <small class="text-secondary fw-semibold">${escapeHtml(label)}</small>
        </div>
      `;
    })
    .join("");
}

function renderMonthly() {
  const monthly = state.insights?.monthly || [];
  const activeDays = monthly.filter((day) => day.count > 0).length;
  document.querySelector("#monthlySummary").textContent = `${activeDays} active day${activeDays === 1 ? "" : "s"}`;

  document.querySelector("#monthlyChart").innerHTML = monthly
    .map((day) => {
      const intensity = Math.min(4, day.count);
      const missed = day.missed > 0;
      const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
      return `
        <span class="month-cell level-${intensity} ${missed ? "has-miss" : ""}" title="${label}: ${day.count} done, ${day.missed} not done"></span>
      `;
    })
    .join("");
}

function renderMilestones() {
  const milestones = state.insights?.milestones?.milestones || [];
  const container = document.querySelector("#milestoneList");

  container.innerHTML = milestones
    .map(
      (milestone) => `
        <article class="milestone-card ${milestone.achieved ? "is-achieved" : ""}">
          <span class="stat-icon">
            <i class="bi bi-${escapeHtml(milestone.icon)}"></i>
          </span>
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
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-bullseye fs-3 d-block mb-2"></i>
        Add a daily, monthly, or yearly goal.
      </div>
    `;
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
            <button class="btn btn-light icon-btn delete-goal" data-id="${goal.id}" aria-label="Delete goal">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="d-flex justify-content-between small text-secondary mb-2">
            <span>${goal.currentValue} / ${goal.targetValue} ${escapeHtml(goal.unit)}</span>
            <span>${progress}%</span>
          </div>
          <div class="progress mb-3">
            <div class="progress-bar ${goal.status === "COMPLETED" ? "bg-success" : "bg-dark"}" style="width:${progress}%"></div>
          </div>
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
          <h4 class="fw-black mb-1">${escapeHtml(state.user?.name || "User")}</h4>
          <p class="text-secondary mb-0">${escapeHtml(state.user?.email || "")}</p>
        </div>
      </article>
      <article class="profile-card">
        <p class="eyebrow mb-2">Monthly pulse</p>
        <div class="h2 fw-black mb-1">${stats.completionRate || 0}%</div>
        <p class="text-secondary mb-0">30-day consistency</p>
      </article>
      <article class="profile-card">
        <p class="eyebrow mb-2">Sub-habits</p>
        <div class="h2 fw-black mb-1">${stats.subHabits || 0}</div>
        <p class="text-secondary mb-0">Small steps inside habits</p>
      </article>
      <article class="profile-card profile-wide">
        <p class="eyebrow mb-2">Top habits</p>
        ${
          topHabits.length
            ? topHabits
                .map(
                  (habit) => `
                    <div class="analytics-row">
                      <span>${escapeHtml(habit.title)}</span>
                      <strong>${habit.completions}</strong>
                    </div>
                  `
                )
                .join("")
            : `<p class="text-secondary mb-0">Complete habits to unlock rankings.</p>`
        }
      </article>
      <article class="profile-card profile-wide">
        <p class="eyebrow mb-2">Categories</p>
        ${
          categories.length
            ? categories
                .map(
                  (category) => `
                    <div class="analytics-row">
                      <span>${escapeHtml(category.category)}</span>
                      <strong>${category.completions}</strong>
                    </div>
                  `
                )
                .join("")
            : `<p class="text-secondary mb-0">Add habits to see category analytics.</p>`
        }
      </article>
      <article class="profile-card profile-wide">
        <p class="eyebrow mb-2">Next milestone</p>
        <h4 class="h6 fw-bold mb-1">${escapeHtml(next?.title || "First spark")}</h4>
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
      cadence: document.querySelector("#habitCadence").value,
      color: document.querySelector("#habitColor").value,
      icon: document.querySelector("#habitIcon").value,
      subHabits
    })
  });

  bootstrap.Modal.getInstance(document.querySelector("#habitModal")).hide();
  event.target.reset();
  document.querySelector("#habitCategory").value = "Lifestyle";
  document.querySelector("#habitColor").value = "#111827";
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

  bootstrap.Modal.getInstance(document.querySelector("#reminderModal")).hide();
  showToast(enabled ? "Daily reminder saved" : "Daily reminder turned off");
});

document.addEventListener("click", async (event) => {
  const statusButton = event.target.closest(".check-status");
  const clearButton = event.target.closest(".clear-check");
  const archiveButton = event.target.closest(".archive-habit");
  const deleteHabitButton = event.target.closest(".delete-habit");
  const addSubHabitButton = event.target.closest(".add-subhabit");
  const subHabitToggle = event.target.closest(".subhabit-toggle");
  const subHabitDelete = event.target.closest(".subhabit-delete");
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
    const title = window.prompt("Sub-habit name");
    if (title?.trim()) {
      await api(`/api/habits/${addSubHabitButton.dataset.id}/subhabits`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim() })
      });
      showToast("Sub-habit added");
      await refresh();
    }
  }

  if (subHabitToggle) {
    const value = subHabitToggle.dataset.done === "true" ? 0 : 1;
    await api(`/api/habits/${subHabitToggle.dataset.habitId}/subhabits/${subHabitToggle.dataset.subId}/logs`, {
      method: "POST",
      body: JSON.stringify({ date: todayKey, value })
    });
    showToast(value ? "Sub-habit complete" : "Sub-habit reopened");
    await refresh();
  }

  if (subHabitDelete) {
    await api(`/api/habits/${subHabitDelete.dataset.habitId}/subhabits/${subHabitDelete.dataset.subId}`, {
      method: "DELETE"
    });
    showToast("Sub-habit deleted");
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

hydrateReminderForm();
setInterval(checkReminder, 30000);

refresh().catch((error) => {
  showToast(error.message || "Unable to load dashboard");
});
