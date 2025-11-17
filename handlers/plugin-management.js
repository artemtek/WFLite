import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

/**
 * Get all installed plugins
 */
export const getPluginsHandler = async (event) => {
    try {
        if (!fs.existsSync(PLUGINS_DIR)) {
            fs.mkdirSync(PLUGINS_DIR, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(PLUGINS_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                try {
                    const filePath = path.join(PLUGINS_DIR, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const plugin = JSON.parse(content);
                    const stats = fs.statSync(filePath);
                    
                    return {
                        id: plugin.id || path.basename(file, '.json'),
                        name: plugin.name || 'Unnamed Plugin',
                        version: plugin.version || '1.0.0',
                        description: plugin.description || '',
                        filename: file,
                        filePath: filePath,
                        modified: stats.mtime,
                        enabled: true // TODO: Implement enable/disable tracking
                    };
                } catch (error) {
                    console.error(`Error reading plugin ${file}:`, error);
                    return null;
                }
            })
            .filter(plugin => plugin !== null)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        return files;
    } catch (error) {
        console.error('Error getting plugins:', error);
        throw new Error(`Failed to get plugins: ${error.message}`);
    }
};

/**
 * Save a plugin
 */
export const savePluginHandler = async (event, pluginData, filename = null) => {
    try {
        // Validate plugin structure
        if (!pluginData.id) {
            throw new Error('Plugin must have an id');
        }
        
        // Generate filename if not provided
        if (!filename) {
            filename = `${pluginData.id}.json`;
        }
        
        // Ensure .json extension
        if (!filename.endsWith('.json')) {
            filename += '.json';
        }
        
        const filePath = path.join(PLUGINS_DIR, filename);
        
        // Write plugin file
        fs.writeFileSync(filePath, JSON.stringify(pluginData, null, 2));
        
        return { success: true, filename, filePath };
    } catch (error) {
        console.error('Error saving plugin:', error);
        throw new Error(`Failed to save plugin: ${error.message}`);
    }
};

/**
 * Delete a plugin
 */
export const deletePluginHandler = async (event, filename) => {
    try {
        const filePath = path.join(PLUGINS_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Plugin ${filename} not found`);
        }
        
        fs.unlinkSync(filePath);
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting plugin:', error);
        throw new Error(`Failed to delete plugin: ${error.message}`);
    }
};

/**
 * Validate plugin JSON
 */
export const validatePluginHandler = async (event, pluginData) => {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!pluginData.id) {
        errors.push('Plugin must have an "id" field');
    }
    if (!pluginData.name) {
        errors.push('Plugin must have a "name" field');
    }
    if (!pluginData.command) {
        errors.push('Plugin must have a "command" field');
    }
    
    // Validate command structure
    if (pluginData.command) {
        if (!pluginData.command.program) {
            errors.push('Command must have a "program" field');
        }
        if (!pluginData.command.args || !Array.isArray(pluginData.command.args)) {
            errors.push('Command must have an "args" array');
        }
    }
    
    // Validate inputs
    if (pluginData.inputs && !Array.isArray(pluginData.inputs)) {
        errors.push('Inputs must be an array');
    }
    
    // Validate outputs
    if (pluginData.outputs && !Array.isArray(pluginData.outputs)) {
        errors.push('Outputs must be an array');
    }
    
    // Warnings
    if (!pluginData.version) {
        warnings.push('Plugin should have a "version" field');
    }
    if (!pluginData.description) {
        warnings.push('Plugin should have a "description" field');
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Fetch plugin from URL
 */
export const fetchPluginFromUrlHandler = async (event, url) => {
    try {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            protocol.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const plugin = JSON.parse(data);
                        resolve(plugin);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON from URL: ${error.message}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Failed to fetch URL: ${error.message}`));
            });
        });
    } catch (error) {
        console.error('Error fetching plugin from URL:', error);
        throw new Error(`Failed to fetch plugin: ${error.message}`);
    }
};

/**
 * Bulk save plugins
 */
export const bulkSavePluginsHandler = async (event, plugins) => {
    const results = [];
    
    for (const plugin of plugins) {
        try {
            const result = await savePluginHandler(event, plugin);
            results.push({ success: true, plugin: plugin.id || plugin.name, ...result });
        } catch (error) {
            results.push({ success: false, plugin: plugin.id || plugin.name, error: error.message });
        }
    }
    
    return results;
};

/**
 * Bulk fetch plugins from URLs
 */
export const bulkFetchPluginsHandler = async (event, urls) => {
    const results = [];
    
    for (const url of urls) {
        try {
            const plugin = await fetchPluginFromUrlHandler(event, url);
            results.push({ success: true, url, plugin });
        } catch (error) {
            results.push({ success: false, url, error: error.message });
        }
    }
    
    return results;
};

