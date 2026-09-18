import { liteAPI } from './api.js';

const params = new URLSearchParams(location.search);
const pickMode = params.get('pick') === '1';

const pathInput = document.getElementById('pathInput');
const filesBody = document.getElementById('filesBody');
const filesError = document.getElementById('filesError');
const currentLabel = document.getElementById('currentLabel');
const pickBanner = document.getElementById('pickBanner');
const useFolderBtn = document.getElementById('useFolderBtn');

let currentPath = '';

if (pickMode) {
  pickBanner.hidden = false;
}

function formatSize(n, isDir) {
  if (isDir) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

async function load(path) {
  filesError.textContent = '';
  try {
    const listing = await liteAPI.listDir(path);
    currentPath = listing.path;
    pathInput.value = listing.path;
    currentLabel.textContent = listing.path;
    filesBody.innerHTML = '';

    if (listing.parent) {
      const row = document.createElement('tr');
      row.className = 'dir';
      row.innerHTML = '<td>..</td><td>parent</td><td></td>';
      row.addEventListener('click', () => load(listing.parent));
      filesBody.appendChild(row);
    }

    if (!listing.entries.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3" class="empty">Empty folder</td>';
      filesBody.appendChild(row);
      return;
    }

    listing.entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.className = entry.dir ? 'dir' : 'file';
      row.innerHTML = `
        <td>${escapeHtml(entry.name)}</td>
        <td>${entry.dir ? 'folder' : 'file'}</td>
        <td>${formatSize(entry.size, entry.dir)}</td>
      `;
      if (entry.dir) {
        row.addEventListener('click', () => load(entry.path));
      }
      filesBody.appendChild(row);
    });
  } catch (err) {
    filesError.textContent = err.message;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById('goBtn').addEventListener('click', () => load(pathInput.value));
pathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') load(pathInput.value);
});
document.getElementById('upBtn').addEventListener('click', async () => {
  const listing = await liteAPI.listDir(currentPath);
  if (listing.parent) load(listing.parent);
});
document.getElementById('homeBtn').addEventListener('click', async () => {
  const { path } = await liteAPI.homeDir();
  load(path);
});
document.getElementById('workflowsBtn').addEventListener('click', async () => {
  const { path } = await liteAPI.workflowsDir();
  load(path);
});

useFolderBtn.addEventListener('click', () => {
  sessionStorage.setItem('lite.pickedFolder', currentPath);
  location.href = '/';
});

const start = sessionStorage.getItem('lite.browsePath') || '';
if (start) {
  load(start);
} else {
  liteAPI.homeDir().then(({ path }) => load(path)).catch((err) => {
    filesError.textContent = err.message;
  });
}
