const authAlert = document.querySelector("#authAlert");
const googleButton = document.querySelector("#googleButton");
const googleHint = document.querySelector("#googleHint");

function showError(message) {
  authAlert.textContent = message;
  authAlert.classList.remove("d-none");
}

function clearError() {
  authAlert.textContent = "";
  authAlert.classList.add("d-none");
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

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Request failed.");
  }

  if (response.status === 204) return null;
  return response.json();
}

async function boot() {
  try {
    const { user } = await api("/api/auth/me");
    if (user) window.location.href = "/app.html";
  } catch (error) {
    // No active session is fine on the login page.
  }

  try {
    const { enabled } = await api("/api/auth/google/status");
    if (enabled) {
      googleButton.classList.remove("disabled");
      googleHint.classList.add("d-none");
    }
  } catch (error) {
    googleHint.textContent = "Google status is unavailable right now.";
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("auth") === "google-not-configured") {
    showError("Google login is not configured yet.");
  }
  if (params.get("auth") === "google-failed") {
    showError("Google login failed. Please try again.");
  }
}

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#loginEmail").value,
        password: document.querySelector("#loginPassword").value
      })
    });
    window.location.href = "/app.html";
  } catch (error) {
    showError(error.message);
  }
});

document.querySelector("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#registerName").value,
        email: document.querySelector("#registerEmail").value,
        password: document.querySelector("#registerPassword").value
      })
    });
    window.location.href = "/app.html";
  } catch (error) {
    showError(error.message);
  }
});

boot();
