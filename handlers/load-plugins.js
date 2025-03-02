import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadPluginsHandler = async (event) => {
    const plugins = fs.readdirSync(path.join(__dirname, '..', 'plugins'));
    const parsedPlugins = plugins.map(plugin => 
        JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugins', plugin), 'utf8'))
    );
    return parsedPlugins;
};