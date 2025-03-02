import { dialog } from 'electron';
import fs from 'fs';

export const dialogLoadFileHandler = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    });
    if (canceled || filePaths.length === 0) {
        return null;
    } else {
        const filePath = filePaths[0];
        // Read file contents (adjust encoding as needed)
        const data = fs.readFileSync(filePath, 'utf8');

        // try to parse the data as json
        try {
            return JSON.parse(data);
        } catch (e) {
            // throw error, show alert
            dialog.showMessageBox({
                title: 'Error',
                message: 'Failed to parse the file as JSON',
                detail: e.message
            });
            return null;
        }
    }
}