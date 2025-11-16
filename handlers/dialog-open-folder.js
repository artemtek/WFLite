import { dialog, BrowserWindow } from 'electron';

export const dialogOpenFolderHandler = async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) {
        return null;
    } else {
        return filePaths[0]; // Return the full path to the selected folder
    }
}

