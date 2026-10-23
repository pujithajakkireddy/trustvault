
const notice = document.getElementById("notice");
const authSection = document.getElementById("auth-section");
const workspace = document.getElementById("workspace");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const documentList = document.getElementById("document-list");

let csrfToken = "";
let currentUser = null;

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();

    if (
    csrfToken &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    path.startsWith("/api/")
  ) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "same-origin"
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

function showNotice(message, type = "success") {
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
}

function clearNotice() {
  notice.textContent = "";
  notice.hidden = true;
  notice.className = "notice";
}

function setAuthTab(tab) {
  const loginSelected = tab === "login";

  loginForm.hidden = !loginSelected;
  registerForm.hidden = loginSelected;

  document.getElementById("login-tab").classList.toggle("active", loginSelected);
  document.getElementById("register-tab").classList.toggle("active", !loginSelected);

  document.getElementById("login-tab").setAttribute("aria-selected", String(loginSelected));
  document.getElementById("register-tab").setAttribute("aria-selected", String(!loginSelected));

  clearNotice();
}

function showWorkspace(user) {
  currentUser = user;
  authSection.hidden = true;
  workspace.hidden = false;

  const name = user.name || user.email || "User";
  const role = user.role || "viewer";

  document.getElementById("user-summary").textContent =
    `Signed in as ${name} · Role: ${role}`;

  // The server remains responsible for enforcing administrator access.
  document.getElementById("admin-section").hidden = role !== "admin";

  clearNotice();
}

function showSignedOut() {
  currentUser = null;
  csrfToken = "";
  authSection.hidden = false;
  workspace.hidden = true;
  document.getElementById("admin-section").hidden = true;
  document.getElementById("audit-list").replaceChildren();
  documentList.replaceChildren();
}

async function refreshCsrfToken() {
  const result = await api("/api/auth/csrf-token");
  csrfToken = result.csrfToken;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);

  return element;
}

function makeButton(text, onClick, className = "button secondary") {
  const button = makeElement("button", className, text);
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      await onClick();
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  return button;
}

async function loadDocuments(filters = {}) {
  documentList.replaceChildren(makeElement("p", "muted", "Loading documents…"));

  try {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) params.set(key, value.trim());
    }

    const query = params.toString();
    const result = await api(`/api/documents${query ? `?${query}` : ""}`);

    // Accept the documented list shape and report unexpected API responses.
    const documents = Array.isArray(result)
      ? result
      : result?.documents;

    if (!Array.isArray(documents)) {
      throw new Error("Unexpected document-list response. Check the API response shape.");
    }

    documentList.replaceChildren();

    if (documents.length === 0) {
      documentList.append(makeElement("p", "muted", "No accessible documents found."));
      return;
    }

    for (const doc of documents) {
      const card = makeElement("article", "document-card");
      card.append(makeElement("h4", "", doc.name || "Untitled document"));
      card.append(makeElement("p", "", `Category: ${doc.category || "Uncategorized"}`));

      if (doc.created_at || doc.createdAt) {
        const date = new Date(doc.created_at || doc.createdAt);
        if (!Number.isNaN(date.getTime())) {
          card.append(makeElement("p", "", `Added: ${date.toLocaleString()}`));
        }
      }

      const actions = makeElement("div", "document-actions");

      if (doc.id) {
        actions.append(
          makeButton("Download", async () => {
            const response = await fetch(
              `/api/documents/${encodeURIComponent(doc.id)}/download`,
              { credentials: "same-origin" }
            );

            if (!response.ok) {
              let message = `Download failed (${response.status})`;

              try {
                const data = await response.json();
                message = data.error || data.message || message;
              } catch {}

              throw new Error(message);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = doc.name || "document";
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
          }, "button primary")
        );
      }

      card.append(actions);
      documentList.append(card);
    }
  } catch (error) {
    documentList.replaceChildren();
    documentList.append(makeElement("p", "muted", error.message));
    throw error;
  }
}

async function loadAuditLogs() {
  const result = await api("/api/admin/audit-logs?limit=50");
  const logs = result.auditLogs;

  const container = document.getElementById("audit-list");
  container.replaceChildren();

  if (!Array.isArray(logs) || logs.length === 0) {
    container.append(makeElement("p", "muted", "No audit records found."));
    return;
  }

  for (const log of logs) {
    const card = makeElement("article", "audit-card");

    card.append(makeElement("strong", "", log.action || log.event_type || "Activity"));

    const detail = [
      log.document_id ? `Document: ${log.document_id}` : "",
      log.user_id ? `User: ${log.user_id}` : "",
      log.created_at ? new Date(log.created_at).toLocaleString() : ""
    ].filter(Boolean).join(" · ");

    if (detail) card.append(makeElement("p", "", detail));
    container.append(card);
  }
}

document.getElementById("login-tab").addEventListener("click", () => setAuthTab("login"));
document.getElementById("register-tab").addEventListener("click", () => setAuthTab("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const form = new FormData(loginForm);
    const result = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });

    await refreshCsrfToken();
    showWorkspace(result.user);
    await loadDocuments();
    showNotice("Successfully signed in.");
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const button = registerForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const form = new FormData(registerForm);

    await api("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password")
      })
    });

    registerForm.reset();
    setAuthTab("login");
    showNotice("Account created. Sign in with your new account.");
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const formData = new FormData(event.currentTarget);

    const uploadForm = event.currentTarget;

    await api("/api/documents/upload", {
    method: "POST",
    body: formData
    });

    uploadForm.reset();
    await loadDocuments();
    showNotice("Document uploaded successfully.");
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const form = new FormData(event.currentTarget);

  try {
    await loadDocuments({
      name: String(form.get("name") || ""),
      category: String(form.get("category") || "")
    });
  } catch (error) {
    showNotice(error.message, "error");
  }
});

document.getElementById("clear-search").addEventListener("click", async () => {
  document.getElementById("search-form").reset();

  try {
    await loadDocuments();
    showNotice("Search cleared.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

document.getElementById("refresh-button").addEventListener("click", async () => {
  try {
    await loadDocuments();
    showNotice("Document list refreshed.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

document.getElementById("audit-button").addEventListener("click", async () => {
  try {
    await loadAuditLogs();
    showNotice("Audit log loaded.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    showSignedOut();
    setAuthTab("login");
    showNotice("You have signed out.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

async function initialize() {
  try {
    const result = await api("/api/auth/me");

    if (result.user) {
      await refreshCsrfToken();
      showWorkspace(result.user);
      await loadDocuments();
    } else {
      showSignedOut();
    }
  } catch {
    showSignedOut();
  }
}

initialize();
