class FolderPickerNode {
    title = "Folder Picker";
    desc = "Select a folder from the user's machine.";

    constructor() {
        this.addOutput("Folder", "directory");
        this.properties = { folder: "" };

        this.addWidget("button", "Choose Folder", "", () => {
            if (window.graph) {
                sessionStorage.setItem("lite.graph.fanout", JSON.stringify(window.graph.serialize()));
            }
            sessionStorage.setItem("lite.pickNodeId", String(this.id));
            location.href = "/files.html?pick=1";
        });

        this.folderLabelWidget = this.addWidget("text", "Current Folder", this.properties.folder, () => { }, { disabled: true });
    }

    onExecute() {
        this.setOutputData(0, this.properties.folder);
    }
}

LiteGraph.registerNodeType("input/folder_picker", FolderPickerNode);
