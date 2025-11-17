class FolderPickerNode {
    title = "Folder Picker";
    desc = "Select a folder from the user's machine.";

    constructor() {
        // Create an output port named "Folder" of type "directory" to connect with directory inputs.
        this.addOutput("Folder", "directory");

        // Default property for the selected folder (full path).
        this.properties = { folder: "" };

        // Add a widget button that displays "Choose Folder" on the node.
        // When clicked, it opens Electron's folder picker dialog to get the full path.
        this.addWidget("button", "Choose Folder", "", () => {
            console.log("Choose Folder button clicked");
            
            if (!window.electronAPI) {
                console.error("window.electronAPI is not available");
                return;
            }
            
            if (!window.electronAPI.dialogOpenFolder) {
                console.error("dialogOpenFolder is not available on electronAPI");
                console.log("Available methods:", Object.keys(window.electronAPI));
                return;
            }
            
            // Wrap async call in promise handling
            window.electronAPI.dialogOpenFolder()
                .then((folderPath) => {
                    console.log("Dialog returned:", folderPath);
                    if (folderPath) {
                        this.properties.folder = folderPath;
                        
                        // Log the selected folder full path
                        console.log("Folder Picker - Selected folder (full path):", this.properties.folder);
                        
                        // Update the label widget with the folder path.
                        if (this.folderLabelWidget) {
                            // Show just the folder name or last part of path for display
                            const pathParts = folderPath.split(/[/\\]/);
                            const displayName = pathParts[pathParts.length - 1] || folderPath;
                            this.folderLabelWidget.value = displayName;
                        }
                        // Trigger a node update.
                        this.setDirtyCanvas(true);
                    } else {
                        console.log("No folder selected (user cancelled)");
                    }
                })
                .catch((error) => {
                    console.error("Error opening folder dialog:", error);
                });
        });

        // Add a read-only text widget to display the current folder selection.
        // This acts as a label showing the folder name.
        this.folderLabelWidget = this.addWidget("text", "Current Folder", this.properties.folder, () => { }, { disabled: true });
    }

    onExecute() {
        // Output the selected folder (full path) on every execution cycle.
        this.setOutputData(0, this.properties.folder);
    }
}

LiteGraph.registerNodeType("input/folder_picker", FolderPickerNode);
