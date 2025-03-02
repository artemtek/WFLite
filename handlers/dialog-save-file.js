import { dialog } from 'electron';
import fs from 'fs';

export const dialogSaveFileHandler = async (data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      properties: ['saveFile'],
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ],
      defaultPath: 'graph.json'
    });
    if (canceled || !filePath) {
      return null;
    } else {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      dialog.showMessageBox({
        title: 'Success',
        message: 'File saved successfully',
        detail: filePath
      });
      return filePath;
    }
  }