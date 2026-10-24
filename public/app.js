
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
    throw new Error(
      data?.error || data?.message || `Request failed (${response.status})`
    );
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

    meta.append(
      el("span", "pill", doc.category || "Uncategorized")
    );

    meta.append(
      el(
        "span",
        ownsDocument(doc) ? "pill" : "pill shared",
        ownsDocument(doc) ? "Owned by you" : "Shared with you"
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
      actions.append(
        button("Edit details", () => editDocument(doc))
      );
    }

    if (doc.id && ownsDocument(doc)) {
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

async function shareDocument(doc) {
  const userId = window.prompt(
    "Enter the existing TrustVault user's ID (UUID) to share with:"
  );

  if (userId === null) return;

  const targetId = userId.trim();

  if (!targetId) {
    throw new Error("A user ID is required.");
  }

  const access = window.prompt(
    "Enter READ or EDIT. EDIT includes read access.",
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
        userId: targetId,
        canRead: true,
        canEdit: level === "edit"
      })
    }
  );

  showNotice(
    `Access granted: ${level.toUpperCase()}. The recipient can refresh their document library.`
  );
}

async function revokeDocument(doc) {
  const userId = window.prompt(
    "Enter the TrustVault user ID (UUID) whose access should be revoked:"
  );

  if (userId === null) return;

  const targetId = userId.trim();

  if (!targetId) {
    throw new Error("A user ID is required.");
  }

  if (!window.confirm("Revoke this user's access to the selected document?")) {
    return;
  }

  await api(
    `/api/documents/${encodeURIComponent(doc.id)}/permissions/${encodeURIComponent(targetId)}`,
    { method: "DELETE" }
  );

  await loadDocuments();
  showNotice("Document access revoked.");
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
