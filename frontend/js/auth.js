const AUTH_KEY = "fusballAuth";

function getAuth() {
  const parsed = safeAuthParse(localStorage.getItem(AUTH_KEY));
  return parsed && parsed.token && parsed.user ? parsed : null;
}

function safeAuthParse(value) {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

function setAuth(data) {
  if (!data?.token || !data?.user) throw new Error("Invalid authentication response.");
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function getToken() {
  return getAuth()?.token || null;
}

async function apiAuth(path, method = "GET", body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearAuth();
  }

  if (!response.ok) throw new Error(data.message || `API ${response.status}`);
  return data;
}

function logout() {
  clearAuth();
  sessionStorage.clear();
  location.replace("/login.html");
}

function requireAdminPage() {
  const auth = getAuth();
  if (!auth?.token || auth.user?.role !== "admin") {
    location.replace("../login.html");
    return false;
  }
  return true;
}
