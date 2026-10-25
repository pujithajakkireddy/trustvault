"use strict";

const $ = (id) => document.getElementById(id);
const notice = $("notice");
const authSection = $("auth-section");
const workspace = $("workspace");
const loginForm = $("login-form");
const registerForm = $("register-form");
const documentList = $("document-list");

let csrfToken = "";
let currentUser = null;
let activeFilters = {};
let cachedDocuments = [];
let noticeTimer = null;

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function api(path, options = {}, retryCsrf = true) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const isMutation =
    MUTATING_METHODS.includes(method) && path.startsWith("/api/");

  if (isMutation) {
    const tokenResponse = await fetch("/api/auth/csrf-token", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || !tokenData.csrfToken) {
      throw new Error(
        "Unable to obtain a CSRF token. Please sign in again."
      );
    }

    csrfToken = tokenData.csrfToken;
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

  const message = data?.error || data?.message || "";

  if (
    response.status === 403 &&
    retryCsrf &&
    /csrf/i.test(message)
  ) {
    return api(path, options, false);
  }

  if (!response.ok) {
    throw new Error(message || `Request failed (${response.status})`);
  }

  return data;
}

function showNotice(message, type = "success") {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;

  noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 6500);
}

function clearNotice() {
  clearTimeout(noticeTimer);
  notice.textContent = "";
  notice.hidden = true;
  notice.className = "notice";
}

function setAuthTab(tab) {
  const loginSelected = tab === "login";

  loginForm.hidden = !loginSelected;
  registerForm.hidden = loginSelected;

  $("login-tab").classList.toggle("active", loginSelected);
  $("register-tab").classList.toggle("active", !loginSelected);
  $("login-tab").setAttribute("aria-selected", String(loginSelected));
  $("register-tab").setAttribute("aria-selected", String(!loginSelected));

  clearNotice();
}

function showWorkspace(user) {
  currentUser = user;
  authSection.hidden = true;
  workspace.hidden = false;

  $("user-summary").textContent =
    `${user.name || user.email || "User"} · ${String(user.role || "viewer").toUpperCase()} ROLE`;

  $("admin-section").hidden = user.role !== "admin";
  clearNotice();
}

function showSignedOut() {
  currentUser = null;
  csrfToken = "";
  cachedDocuments = [];
  activeFilters = {};

  authSection.hidden = false;
  workspace.hidden = true;
  $("admin-section").hidden = true;
  $("audit-list").replaceChildren();
  documentList.replaceChildren();

  $("stat-total").textContent = "—";
  $("stat-owned").textContent = "—";
  $("stat-shared").textContent = "—";
}

async function refreshCsrfToken() {
  const result = await api("/api/auth/csrf-token");

  if (!result?.csrfToken) {
    throw new Error("The server did not return a CSRF token.");
  }

  csrfToken = result.csrfToken;
}

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined && text !== null) {
    node.textContent = String(text);
  }

  return node;
}

function button(label, handler, className = "button secondary") {
  const b = el("button", className, label);
  b.type = "button";

  b.addEventListener("click", async () => {
    b.disabled = true;

    try {
      await handler();
    } catch (error) {
      showNotice(error.message || "Something went wrong.", "error");
    } finally {
      b.disabled = false;
    }
  });

  return b;
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ownsDocument(doc) {
  return Boolean(
    currentUser &&
    (
      doc.owner_id === currentUser.id ||
      doc.ownerId === currentUser.id ||
      doc.is_owner === true ||
      doc.isOwner === true
    )
  );
}

function hasEditPermission(doc) {
  return (
    ownsDocument(doc) ||
    doc.can_edit === true ||
    doc.canEdit === true ||
    doc.permission === "edit"
  );
}

function updateStats(docs) {
  const owned = docs.filter(ownsDocument).length;

  $("stat-total").textContent = docs.length;
  $("stat-owned").textContent = owned;
  $("stat-shared").textContent = Math.max(0, docs.length - owned);
}

function renderEmpty(title, description) {
  const box = el("div", "empty-state");

  box.append(
    el("div", "empty-icon", "▤"),
    el("h4", "", title),
    el("p", "", description)
  );

  documentList.replaceChildren(box);
}

function renderDocuments(docs) {
  documentList.replaceChildren();
  updateStats(docs);

  const hasFilters = Object.values(activeFilters)
    .some((value) => String(value || "").trim());

  if (!docs.length) {
    renderEmpty(
      hasFilters ? "No matching documents" : "Your library is ready",
      hasFilters
        ? "Try another name or category, or clear your filters."
        : "Upload a document to get started. Documents shared with you will also appear here."
    );
    return;
  }

  for (const doc of docs) {
    const card = el("article", "document-card");
    const main = el("div", "document-main");

    main.append(el("div", "file-icon", "▤"));

    const info = el("div", "document-info");
    info.append(el("h4", "", doc.name || "Untitled document"));

    const meta = el("div", "document-meta");
    meta.append(el("span", "pill", doc.category || "Uncategorized"));

    const isOwner = ownsDocument(doc);

    meta.append(
      el(
        "span",
        isOwner ? "pill" : "pill shared",
        isOwner ? "Owned by you" : "Shared with you"
      )
    );

    const size = formatBytes(doc.size_bytes ?? doc.sizeBytes);
    if (size) meta.append(el("span", "", size));

    const date = formatDate(doc.created_at || doc.createdAt);
    if (date) meta.append(el("span", "", `Added ${date}`));

    info.append(meta);
    main.append(info);
    card.append(main);

    const actions = el("div", "document-actions");

    if (doc.id) {
      actions.append(
        button("↓ Download", () => downloadDocument(doc), "button primary")
      );
    }

    if (doc.id && hasEditPermission(doc)) {
      actions.append(button("Edit details", () => editDocument(doc)));
    }

    if (doc.id && isOwner) {
      actions.append(
        button("Share access", () => shareDocument(doc)),
        button("Revoke access", () => revokeDocument(doc)),
        button("Delete", () => deleteDocument(doc), "button danger")
      );
    }

    if (!doc.id) {
      actions.append(
        el("span", "muted", "Actions unavailable: missing document ID")
      );
    }

    card.append(actions);
    documentList.append(card);
  }
}

async function loadDocuments(filters = activeFilters) {
  documentList.replaceChildren(
    el("p", "muted", "Loading accessible documents…")
  );

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters || {})) {
    if (String(value || "").trim()) {
      params.set(key, String(value).trim());
    }
  }

  const query = params.toString();
  const result = await api(
    `/api/documents${query ? `?${query}` : ""}`
  );

  const docs = Array.isArray(result)
    ? result
    : result?.documents;

  if (!Array.isArray(docs)) {
    throw new Error(
      "Unexpected document-list response. Check the API response shape."
    );
  }

  activeFilters = { ...(filters || {}) };
  cachedDocuments = docs;
  renderDocuments(docs);

  const active = Object.entries(activeFilters)
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`);

  $("active-filter").hidden = active.length === 0;
  $("active-filter").textContent =
    active.length ? `Filters · ${active.join(" · ")}` : "";
}

async function downloadDocument(doc) {
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

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showNotice("Download started.");
}

async function editDocument(doc) {
  const name = window.prompt("Document name", doc.name || "");
  if (name === null) return;

  const category = window.prompt(
    "Category",
    doc.category || "Uncategorized"
  );

  if (category === null) return;

  const cleanName = name.trim();
  const cleanCategory = category.trim();

  if (!cleanName || !cleanCategory) {
    throw new Error("Name and category cannot be empty.");
  }

  await api(`/api/documents/${encodeURIComponent(doc.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: cleanName,
      category: cleanCategory
    })
  });

  await loadDocuments();
  showNotice("Document details updated.");
}

/*
 * Share a document by the recipient's registered email address.
 * The backend searches for the account and returns its user ID.
 * The existing permissions endpoint then grants the selected access.
 */
async function shareDocument(doc) {
  const emailInput = window.prompt(
    "Enter the recipient's registered email address:",
    ""
  );

  if (emailInput === null) return;

  const email = emailInput.trim();

  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Please enter a valid email address.");
  }

  const result = await api(
    `/api/documents/users/search?email=${encodeURIComponent(email)}`
  );

  const users = result?.users;

  if (!Array.isArray(users)) {
    throw new Error(
      "Unexpected user-search response. Check the backend API."
    );
  }

  if (users.length === 0) {
    showNotice(
      "No matching account found. Ask the recipient to register or check their email.",
      "error"
    );
    return;
  }

  // Require an exact email match, not just a partial search result.
  const matches = users.filter(
    (user) =>
      typeof user.email === "string" &&
      user.email.toLowerCase() === email.toLowerCase()
  );

  if (matches.length === 0) {
    showNotice(
      "No exact email match found. Check the address and try again.",
      "error"
    );
    return;
  }

  if (matches.length > 1) {
    throw new Error(
      "Multiple accounts returned the same email. Please contact support."
    );
  }

  const recipient = matches[0];

  if (!UUID_PATTERN.test(recipient.id || "")) {
    throw new Error(
      "The selected account has an invalid user ID. Please try again."
    );
  }

  if (
    currentUser?.id &&
    recipient.id.toLowerCase() === String(currentUser.id).toLowerCase()
  ) {
    throw new Error("You cannot share a document with yourself.");
  }

  const confirmed = window.confirm(
    `Share "${doc.name || "this document"}" with:\n\n` +
      `${recipient.name || "TrustVault user"}\n` +
      `${recipient.email}\n\n` +
      "Continue to choose the access level?"
  );

  if (!confirmed) return;

  const access = window.prompt(
    "Choose access level:\n\n" +
      "READ = View and download\n" +
      "EDIT = View, download, and edit document details",
    "READ"
  );

  if (access === null) return;

  const level = access.trim().toLowerCase();

  if (!["read", "edit"].includes(level)) {
    throw new Error("Access level must be READ or EDIT.");
  }

  await api(
    `/api/documents/${encodeURIComponent(doc.id)}/permissions`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: recipient.id,
        canRead: true,
        canEdit: level === "edit"
      })
    }
  );

  showNotice(
    `Access granted to ${recipient.email}: ${level.toUpperCase()}.`
  );
}

/**
 * Fetch only the users who currently have access to this document.
 * The backend endpoint verifies that the current user owns the document.
 */
async function revokeDocument(doc) {
  const result = await api(
    `/api/documents/${encodeURIComponent(doc.id)}/permissions`
  );

  const permissions = result?.permissions;

  if (!Array.isArray(permissions)) {
    throw new Error(
      "Unexpected permissions response. Check the document permissions API."
    );
  }

  if (permissions.length === 0) {
    showNotice(
      "No other users currently have access to this document."
    );
    return;
  }

  const choices = permissions.map((permission, index) => {
    const identity =
      permission.name && permission.email
        ? `${permission.name} (${permission.email})`
        : permission.email || permission.name || "Unknown user";

    const access = permission.can_edit
      ? "Read and edit"
      : permission.can_read
        ? "Read only"
        : "No active read permission";

    return `${index + 1}. ${identity} — ${access}`;
  });

  const answer = window.prompt(
    `Select the user whose access you want to revoke from "${doc.name}".\n\n` +
    choices.join("\n") +
    "\n\nEnter the number next to the user. Cancel to keep all permissions."
  );

  if (answer === null) return;

  const selection = answer.trim();

  if (!/^\d+$/.test(selection)) {
    throw new Error("Enter the number next to the user.");
  }

  const index = Number(selection) - 1;

  if (index < 0 || index >= permissions.length) {
    throw new Error("That selection is not in the list.");
  }

  const selected = permissions[index];
  const targetId = selected.user_id;

  if (!UUID_PATTERN.test(targetId || "")) {
    throw new Error(
      "The selected permission has an invalid user ID. Refresh and try again."
    );
  }

  const identity =
    selected.email || selected.name || "the selected user";

  if (
    !window.confirm(
      `Revoke ${identity}'s access to "${doc.name}"?`
    )
  ) {
    return;
  }

  await api(
    `/api/documents/${encodeURIComponent(doc.id)}/permissions/${encodeURIComponent(targetId)}`,
    { method: "DELETE" }
  );

  await loadDocuments(activeFilters);
  showNotice(`Access revoked for ${identity}.`);
}

async function deleteDocument(doc) {
  if (
    !window.confirm(
      `Permanently delete "${doc.name || "this document"}"? This cannot be undone.`
    )
  ) {
    return;
  }

  await api(`/api/documents/${encodeURIComponent(doc.id)}`, {
    method: "DELETE"
  });

  await loadDocuments();
  showNotice("Document deleted.");
}

async function loadAuditLogs() {
  const result = await api("/api/admin/audit-logs?limit=50");
  const logs = result?.auditLogs;
  const container = $("audit-list");

  container.replaceChildren();

  if (!Array.isArray(logs) || !logs.length) {
    container.append(el("p", "muted", "No audit records found."));
    return;
  }

  for (const log of logs) {
    const card = el("article", "audit-card");

    card.append(
      el(
        "strong",
        "",
        `${log.action || "Activity"}${log.outcome ? ` · ${log.outcome}` : ""}`
      )
    );

    const detail = [
      log.actor_name
        ? `By ${log.actor_name}`
        : log.actor_id
          ? `Actor ID: ${log.actor_id}`
          : "",
      log.document_id ? `Document ID: ${log.document_id}` : "",
      log.target_user_name
        ? `Target: ${log.target_user_name}`
        : log.target_user_id
          ? `Target ID: ${log.target_user_id}`
          : "",
      log.created_at ? formatDate(log.created_at) : "",
      log.details && Object.keys(log.details).length
        ? JSON.stringify(log.details)
        : ""
    ].filter(Boolean).join(" · ");

    if (detail) card.append(el("p", "", detail));
    container.append(card);
  }
}

$("login-tab").addEventListener("click", () => setAuthTab("login"));
$("register-tab").addEventListener("click", () => setAuthTab("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;

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
    await loadDocuments({});
    loginForm.reset();

    showNotice("Signed in successfully.");
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    submit.disabled = false;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const submit = registerForm.querySelector('[type="submit"]');
  submit.disabled = true;

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
    submit.disabled = false;
  }
});

$("upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const file = $("document-file").files[0];

  if (!file) {
    showNotice("Choose a file to upload.", "error");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showNotice("The selected file exceeds the 5 MB limit.", "error");
    return;
  }

  submit.disabled = true;

  try {
    await api("/api/documents/upload", {
      method: "POST",
      body: new FormData(form)
    });

    form.reset();
    await loadDocuments({});
    showNotice("Document uploaded successfully.");
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    submit.disabled = false;
  }
});

$("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  try {
    await loadDocuments({
      name: String(form.get("name") || ""),
      category: String(form.get("category") || "")
    });

    if (Object.values(activeFilters).some((value) => String(value).trim())) {
      showNotice("Document filters applied.");
    }
  } catch (error) {
    showNotice(error.message, "error");
  }
});

$("clear-search").addEventListener("click", async () => {
  $("search-form").reset();

  try {
    await loadDocuments({});
    showNotice("Filters cleared.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

$("refresh-button").addEventListener("click", async () => {
  try {
    await loadDocuments(activeFilters);
    showNotice("Document list refreshed.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

$("audit-button").addEventListener("click", async () => {
  try {
    await loadAuditLogs();
    showNotice("Audit log loaded.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

$("logout-button").addEventListener("click", async () => {
  const logoutButton = $("logout-button");
  logoutButton.disabled = true;

  try {
    await api("/api/auth/logout", { method: "POST" });
    showSignedOut();
    setAuthTab("login");
    showNotice("You have signed out.");
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    logoutButton.disabled = false;
  }
});

async function initialize() {
  try {
    const result = await api("/api/auth/me");

    if (result?.user) {
      await refreshCsrfToken();
      showWorkspace(result.user);
      await loadDocuments({});
    } else {
      showSignedOut();
    }
  } catch {
    showSignedOut();
  }
}

initialize();
// TrustVault password visibility controls
document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const inputId = button.getAttribute("data-password-toggle");
    const input = document.getElementById(inputId);

    if (!input) return;

    const showPassword = input.type === "password";

    input.type = showPassword ? "text" : "password";
    button.setAttribute("aria-pressed", String(showPassword));
    button.setAttribute(
      "aria-label",
      showPassword ? "Hide password" : "Show password"
    );

    input.focus();
  });
});