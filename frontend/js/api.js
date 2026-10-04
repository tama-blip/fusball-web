const API_BASE = window.FUSBALL_API_BASE || "/api";

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

async function apiSend(path, method, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `API ${response.status}`);
  return data;
}
