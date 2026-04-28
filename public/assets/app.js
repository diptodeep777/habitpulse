const state = {
  user: null,
  habits: [],
  goals: [],
  insights: null
};

const todayKey = new Date().toISOString().slice(0, 10);
const toast = new bootstrap.Toast(document.querySelector("#appToast"));

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
    { label: "Checked today", value: stats.checkedToday || 0, icon: "check2-circle", color: "#7fffd4" },
    { label: "Current streak", value: `${stats.streak || 0}d`, icon: "fire", color: "#ff7ab6" },
    { label: "Active goals", value: stats.activeGoals || 0, icon: "bullseye", color: "#76a9ff" }
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
      const done = habit.logs?.some((log) => log.date === todayKey && log.value > 0);
      return `
        <article class="habit-card motion-fade">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
            <span class="habit-icon" style="background:${escapeHtml(habit.color)}">
              <i class="${iconClass(habit.icon)}"></i>
            </span>
            <div class="dropdown">
              <button class="btn btn-light icon-btn" data-bs-toggle="dropdown" aria-label="Habit actions">
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><button class="dropdown-item archive-habit" data-id="${habit.id}">Archive</button></li>
                <li><button class="dropdown-item text-danger delete-habit" data-id="${habit.id}">Delete</button></li>
              </ul>
            </div>
          </div>
          <h3 class="h6 fw-bold mb-1">${escapeHtml(habit.title)}</h3>
          <p class="text-secondary small mb-3">${escapeHtml(habit.category)} · ${escapeHtml(habit.cadence.toLowerCase())}</p>
          <button class="btn btn-outline-dark w-100 check-btn ${done ? "is-done" : ""}" data-id="${habit.id}" data-done="${done}">
            <i class="bi ${done ? "bi-check2-circle" : "bi-circle"}"></i>
            ${done ? "Done today" : "Check in"}
          </button>
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
        <article class="suggestion-card">
          <div class="d-flex gap-3">
            <span class="stat-icon" style="background:#f1f5f9">
              <i class="bi bi-lightning-charge"></i>
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
      const percent = Math.min(100, Math.round((day.count / maxTarget) * 100));
      const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
      return `
        <div class="bar-wrap">
          <div class="bar" title="${day.count} check-ins" style="height:${Math.max(percent, 6)}%"></div>
          <small class="text-secondary fw-semibold">${escapeHtml(label)}</small>
        </div>
      `;
    })
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
        <article class="goal-card">
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
            <div class="progress-bar bg-dark" style="width:${progress}%"></div>
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

function renderAll() {
  renderUser();
  renderStats();
  renderHabits();
  renderSuggestions();
  renderWeekly();
  renderGoals();
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

document.querySelector("#habitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/habits", {
    method: "POST",
    body: JSON.stringify({
      title: document.querySelector("#habitTitle").value,
      category: document.querySelector("#habitCategory").value,
      cadence: document.querySelector("#habitCadence").value,
      color: document.querySelector("#habitColor").value,
      icon: document.querySelector("#habitIcon").value
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

document.addEventListener("click", async (event) => {
  const checkButton = event.target.closest(".check-btn");
  const archiveButton = event.target.closest(".archive-habit");
  const deleteHabitButton = event.target.closest(".delete-habit");
  const deleteGoalButton = event.target.closest(".delete-goal");
  const incrementGoalButton = event.target.closest(".increment-goal");
  const completeGoalButton = event.target.closest(".complete-goal");

  if (checkButton) {
    const habitId = checkButton.dataset.id;
    const done = checkButton.dataset.done === "true";
    if (done) {
      await api(`/api/habits/${habitId}/logs/${todayKey}`, { method: "DELETE" });
      showToast("Check-in removed");
    } else {
      await api(`/api/habits/${habitId}/logs`, {
        method: "POST",
        body: JSON.stringify({ date: todayKey, value: 1 })
      });
      showToast("Checked in");
    }
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

refresh().catch((error) => {
  showToast(error.message || "Unable to load dashboard");
});
