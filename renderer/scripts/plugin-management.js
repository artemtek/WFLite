/**
 * Plugin Management UI
 */
import { convertIctToLite } from './ict-to-lite.js';
import { convertWippToLite } from './wipp-to-lite.js';

let selectedFiles = [];
let editorPluginData = null;

/**
 * Initialize plugin management modal
 */
export function initPluginManagement() {
  const modal = document.getElementById('pluginModal');
  const closeBtn = document.getElementById('pluginModalClose');
  const pluginsBtn = document.getElementById('pluginsBtn');
  
  // Open modal
  pluginsBtn.addEventListener('click', () => {
    modal.classList.add('active');
    loadInstalledPlugins();
  });
  
  // Close modal
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
  
  // Tab switching
  setupTabs();
  
  // Setup tab handlers
  setupInstalledTab();
  setupUploadTab();
  setupUrlTab();
  setupEditorTab();
}

/**
 * Setup tab switching
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
      
      // Refresh installed plugins when switching to that tab
      if (tabName === 'installed') {
        loadInstalledPlugins();
      }
    });
  });
}

/**
 * Setup Installed Plugins tab
 */
function setupInstalledTab() {
  const refreshBtn = document.getElementById('refreshPluginsBtn');
  refreshBtn.addEventListener('click', loadInstalledPlugins);
}

/**
 * Load and display installed plugins
 */
async function loadInstalledPlugins() {
  const pluginsList = document.getElementById('pluginsList');
  pluginsList.innerHTML = '<p>Loading plugins...</p>';
  
  try {
    const plugins = await window.electronAPI.getPlugins();
    
    if (plugins.length === 0) {
      pluginsList.innerHTML = '<p style="color: #888;">No plugins installed.</p>';
      return;
    }
    
    pluginsList.innerHTML = plugins.map(plugin => `
      <div class="plugin-item">
        <div class="plugin-info">
          <div class="plugin-name">${escapeHtml(plugin.name)}</div>
          <div class="plugin-meta">
            ID: ${escapeHtml(plugin.id)} | Version: ${escapeHtml(plugin.version)}<br>
            ${escapeHtml(plugin.description || 'No description')}<br>
            Modified: ${new Date(plugin.modified).toLocaleString()}
          </div>
        </div>
        <div class="plugin-actions">
          <button class="button" onclick="deletePlugin('${escapeHtml(plugin.filename)}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    pluginsList.innerHTML = `<p style="color: #e06c75;">Error loading plugins: ${error.message}</p>`;
  }
}

/**
 * Delete a plugin
 */
window.deletePlugin = async function(filename) {
  if (!confirm(`Delete plugin ${filename}?`)) {
    return;
  }
  
  try {
    await window.electronAPI.deletePlugin(filename);
    loadInstalledPlugins();
    log(`Plugin ${filename} deleted`, 'success');
    
    // Reload plugins in the app
    if (window.reloadPlugins) {
      await window.reloadPlugins();
    }
  } catch (error) {
    log(`Error deleting plugin: ${error.message}`, 'error');
  }
};

/**
 * Setup Bulk Upload tab
 */
function setupUploadTab() {
  const selectBtn = document.getElementById('selectFilesBtn');
  const fileInput = document.getElementById('bulkUploadInput');
  const processBtn = document.getElementById('processUploadBtn');
  const filesList = document.getElementById('uploadedFilesList');
  
  selectBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', async (e) => {
    selectedFiles = Array.from(e.target.files);
    displaySelectedFiles();
    processBtn.disabled = selectedFiles.length === 0;
  });
  
  processBtn.addEventListener('click', async () => {
    await processBulkUpload();
  });
}

/**
 * Display selected files
 */
function displaySelectedFiles() {
  const filesList = document.getElementById('uploadedFilesList');
  
  if (selectedFiles.length === 0) {
    filesList.innerHTML = '<p style="color: #888;">No files selected</p>';
    return;
  }
  
  filesList.innerHTML = selectedFiles.map((file, index) => `
    <div class="uploaded-file">
      <span>${escapeHtml(file.name)}</span>
      <button class="button" onclick="removeFile(${index})" style="padding: 4px 8px; font-size: 11px;">Remove</button>
    </div>
  `).join('');
}

/**
 * Remove file from selection
 */
window.removeFile = function(index) {
  selectedFiles.splice(index, 1);
  displaySelectedFiles();
  document.getElementById('processUploadBtn').disabled = selectedFiles.length === 0;
};

/**
 * Process bulk upload
 */
async function processBulkUpload() {
  const processBtn = document.getElementById('processUploadBtn');
  processBtn.disabled = true;
  processBtn.textContent = 'Processing...';
  
  const plugins = [];
  
  for (const file of selectedFiles) {
    try {
      const text = await file.text();
      let plugin;
      
      // Try to parse as JSON
      try {
        plugin = JSON.parse(text);
      } catch (e) {
        // If JSON fails, try YAML (ICT format)
        // For now, we'll just show an error - YAML parsing would need a library
        log(`Error parsing ${file.name}: Not valid JSON. YAML support coming soon.`, 'error');
        continue;
      }
      
      // Check if it's ICT or WIPP format and convert
      if (plugin.container || plugin.entrypoint) {
        // ICT format
        plugin = convertIctToLite(plugin);
      } else if (plugin.containerId || plugin.baseCommand) {
        // WIPP format
        plugin = convertWippToLite(plugin);
      }
      
      // Validate
      const validation = await window.electronAPI.validatePlugin(plugin);
      if (!validation.valid) {
        log(`Plugin ${file.name} validation failed: ${validation.errors.join(', ')}`, 'error');
        continue;
      }
      
      plugins.push(plugin);
    } catch (error) {
      log(`Error processing ${file.name}: ${error.message}`, 'error');
    }
  }
  
  if (plugins.length === 0) {
    processBtn.disabled = false;
    processBtn.textContent = 'Upload Selected Files';
    return;
  }
  
  // Save all plugins
  try {
    const results = await window.electronAPI.bulkSavePlugins(plugins);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    log(`Uploaded ${successCount} plugin(s) successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 
        failCount > 0 ? 'warning' : 'success');
    
    // Reset
    selectedFiles = [];
    document.getElementById('bulkUploadInput').value = '';
    displaySelectedFiles();
    processBtn.disabled = true;
    processBtn.textContent = 'Upload Selected Files';
    
    // Refresh installed plugins if on that tab
    if (document.getElementById('tab-installed').classList.contains('active')) {
      loadInstalledPlugins();
    }
    
    // Reload plugins in the app
    if (window.reloadPlugins) {
      await window.reloadPlugins();
    }
  } catch (error) {
    log(`Error saving plugins: ${error.message}`, 'error');
  }
  
  processBtn.disabled = false;
  processBtn.textContent = 'Upload Selected Files';
}

/**
 * Setup From URL tab
 */
function setupUrlTab() {
  const fetchBtn = document.getElementById('fetchUrlsBtn');
  
  fetchBtn.addEventListener('click', async () => {
    const urlTextarea = document.getElementById('urlListTextarea');
    const urls = urlTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
    
    if (urls.length === 0) {
      log('No valid URLs found', 'warning');
      return;
    }
    
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';
    
    const resultsDiv = document.getElementById('urlFetchResults');
    resultsDiv.innerHTML = '<p>Fetching plugins...</p>';
    
    try {
      const results = await window.electronAPI.bulkFetchPlugins(urls);
      
      const plugins = [];
      resultsDiv.innerHTML = results.map(result => {
        if (result.success) {
          plugins.push(result.plugin);
          return `<div class="fetch-result success">✓ ${escapeHtml(result.url)}</div>`;
        } else {
          return `<div class="fetch-result error">✗ ${escapeHtml(result.url)}: ${escapeHtml(result.error)}</div>`;
        }
      }).join('');
      
      if (plugins.length > 0) {
        // Convert ICT/WIPP if needed and save
        const convertedPlugins = plugins.map(plugin => {
          if (plugin.container || plugin.entrypoint) {
            return convertIctToLite(plugin);
          } else if (plugin.containerId || plugin.baseCommand) {
            return convertWippToLite(plugin);
          }
          return plugin;
        });
        
        const saveResults = await window.electronAPI.bulkSavePlugins(convertedPlugins);
        const successCount = saveResults.filter(r => r.success).length;
        
        log(`Fetched and saved ${successCount} plugin(s)`, 'success');
        
        if (document.getElementById('tab-installed').classList.contains('active')) {
          loadInstalledPlugins();
        }
        
        // Reload plugins in the app
        if (window.reloadPlugins) {
          await window.reloadPlugins();
        }
      }
    } catch (error) {
      resultsDiv.innerHTML = `<div class="fetch-result error">Error: ${escapeHtml(error.message)}</div>`;
      log(`Error fetching plugins: ${error.message}`, 'error');
    }
    
    fetchBtn.disabled = false;
    fetchBtn.textContent = 'Fetch Plugins';
  });
}

/**
 * Setup Text Editor tab
 */
function setupEditorTab() {
  const editorTextarea = document.getElementById('pluginEditorTextarea');
  const validateBtn = document.getElementById('validateEditorBtn');
  const saveBtn = document.getElementById('saveEditorBtn');
  const resultsDiv = document.getElementById('editorValidationResults');
  
  validateBtn.addEventListener('click', async () => {
    try {
      const text = editorTextarea.value.trim();
      if (!text) {
        resultsDiv.innerHTML = '<div class="validation-error">Please enter plugin JSON</div>';
        return;
      }
      
      let plugin = JSON.parse(text);
      
      // Convert if needed
      if (plugin.container || plugin.entrypoint) {
        plugin = convertIctToLite(plugin);
      } else if (plugin.containerId || plugin.baseCommand) {
        plugin = convertWippToLite(plugin);
      }
      
      editorPluginData = plugin;
      
      // Validate
      const validation = await window.electronAPI.validatePlugin(plugin);
      
      let html = '';
      if (validation.valid) {
        html += '<div class="validation-success">✓ Plugin is valid!</div>';
        saveBtn.disabled = false;
      } else {
        html += '<div class="validation-error">✗ Validation failed:</div>';
        validation.errors.forEach(error => {
          html += `<div class="validation-error">  • ${escapeHtml(error)}</div>`;
        });
        saveBtn.disabled = true;
      }
      
      if (validation.warnings.length > 0) {
        html += '<div style="margin-top: 10px;">Warnings:</div>';
        validation.warnings.forEach(warning => {
          html += `<div class="validation-warning">  • ${escapeHtml(warning)}</div>`;
        });
      }
      
      resultsDiv.innerHTML = html;
    } catch (error) {
      resultsDiv.innerHTML = `<div class="validation-error">Error: ${escapeHtml(error.message)}</div>`;
      saveBtn.disabled = true;
      editorPluginData = null;
    }
  });
  
  saveBtn.addEventListener('click', async () => {
    if (!editorPluginData) {
      log('Please validate the plugin first', 'error');
      return;
    }
    
    try {
      await window.electronAPI.savePlugin(editorPluginData);
      log(`Plugin ${editorPluginData.id} saved successfully`, 'success');
      editorTextarea.value = '';
      resultsDiv.innerHTML = '';
      saveBtn.disabled = true;
      editorPluginData = null;
      
      // Always refresh the installed plugins list
      loadInstalledPlugins();
      
      // Reload plugins in the app
      if (window.reloadPlugins) {
        await window.reloadPlugins();
      }
    } catch (error) {
      log(`Error saving plugin: ${error.message}`, 'error');
    }
  });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

