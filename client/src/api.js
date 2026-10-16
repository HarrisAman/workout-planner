async function req(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  status: () => req('GET', '/status'),
  list: (c) => req('GET', `/${c}`),
  create: (c, b) => req('POST', `/${c}`, b),
  update: (c, id, b) => req('PUT', `/${c}/${id}`, b),
  remove: (c, id) => req('DELETE', `/${c}/${id}`),
  restore: (c, id, sha) => req('POST', `/${c}/${id}/restore`, { sha }),
  history: (path) => req('GET', `/history?path=${encodeURIComponent(path)}`),
  version: (path, sha) => req('GET', `/version?path=${encodeURIComponent(path)}&sha=${sha}`),
  schedule: {
    list: (from, to) => req('GET', `/schedule?from=${from}&to=${to}`),
    add: (routineId, date) => req('POST', '/schedule', { routineId, date }),
    patch: (id, body) => req('PATCH', `/schedule/${id}`, body),
    remove: (id) => req('DELETE', `/schedule/${id}`),
    restore: (week, sha) => req('POST', '/schedule/restore', { week, sha }),
  },
};
