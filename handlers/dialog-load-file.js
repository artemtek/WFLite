import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';

export const dialogLoadFileHandler = async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    });
    if (canceled || filePaths.length === 0) {
        return null;
    } else {
        const filePath = filePaths[0];
        // Read file contents
        const data = fs.readFileSync(filePath, 'utf8');

        // try to parse the data as json
        try {
            return JSON.parse(data);
        } catch (e) {
            // show error dialog
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Error',
                message: 'Failed to parse the file as JSON',
                detail: e.message
            });
            return null;
        }
    }
}