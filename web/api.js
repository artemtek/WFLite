async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    throw new Error((data && data.error) || res.statusText);
  }
  return data;
}

export const liteAPI = {
  loadPlugins: () => request('/api/plugins'),
  getPlugins: () => request('/api/plugins'),
  savePlugin: (pluginData, filename) =>
    request('/api/plugins', { method: 'POST', body: JSON.stringify({ plugin: pluginData, filename }) }),
  deletePlugin: (filename) =>
    request('/api/plugins?filename=' + encodeURIComponent(filename), { method: 'DELETE' }),
  validatePlugin: (pluginData) =>
    request('/api/plugins/validate', { method: 'POST', body: JSON.stringify(pluginData) }),
  fetchPluginFromUrl: (url) =>
    request('/api/plugins/fetch', { method: 'POST', body: JSON.stringify({ url }) }),
  bulkSavePlugins: (plugins) =>
    request('/api/plugins/bulk', { method: 'POST', body: JSON.stringify(plugins) }),
  bulkFetchPlugins: (urls) =>
    request('/api/plugins/fetch-bulk', { method: 'POST', body: JSON.stringify({ urls }) }),
  executeWorkflow: (workflow) =>
    request('/api/workflows/run', { method: 'POST', body: JSON.stringify(workflow) }),
  getJob: (id) => request('/api/jobs/' + encodeURIComponent(id)),
  killWorkflowProcesses: () => request('/api/workflows/stop', { method: 'POST' }),
  listDir: (path) => request('/api/fs?path=' + encodeURIComponent(path || '')),
  homeDir: () => request('/api/fs/home'),
  workflowsDir: () => request('/api/fs/workflows'),
};

window.liteAPI = liteAPI;
