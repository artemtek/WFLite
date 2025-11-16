import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';

export const dialogSaveFileHandler = async (event, data) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      properties: ['saveFile'],
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ],
      defaultPath: 'workflow.json'
    });
    if (canceled || !filePath) {
      return null;
    } else {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Success',
        message: 'Workflow saved successfully',
        detail: filePath
      });
      return filePath;
    }
  }