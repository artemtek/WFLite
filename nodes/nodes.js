class SimpleConverterNode {
    constructor() {

        // Add input port for the file
        this.addInput("Input File", "file");

        // Add output port for the converted file
        this.addOutput("Output File", "file");

        // Set default property for conversion type
        this.properties = {
            conversionType: "txt-to-pdf"
        };

        // Add a widget (combo box) for conversion type selection
        this.addWidget("combo", "Conversion Type", this.properties.conversionType, (v) => {
            this.properties.conversionType = v;
        }, { values: ["txt-to-pdf", "csv-to-json"] });

        // Command template based on the JSON configuration
        this.command = "docker run --rm simple_converter:latest --input {inputFile} --conversion {conversionType} --output {outputFile}";
    }
}
SimpleConverterNode.id = "simple_converter";
SimpleConverterNode.title = "Simple File Converter 123";
SimpleConverterNode.desc = "Converts a file from one format to another using a Docker-based converter.";

// Register the node type in LiteGraph under a custom category ("plugin")
LiteGraph.registerNodeType("plugin/simple_converter", SimpleConverterNode);

class FolderPickerNode {
    title = "Folder Picker";
    desc = "Select a folder from the user's machine.";

    constructor() {
        // Create an output port named "Folder" of type "string".
        this.addOutput("Folder", "string");

        // Default property for the selected folder.
        this.properties = { folder: "" };

        // Create a hidden file input element that supports folder selection.
        this.folderInput = document.createElement("input");
        this.folderInput.type = "file";
        this.folderInput.setAttribute("webkitdirectory", "true");
        this.folderInput.style.display = "none";
        document.body.appendChild(this.folderInput);

        // Listen for when the user selects a folder.
        this.folderInput.addEventListener("change", (e) => {
            if (this.folderInput.files.length > 0) {
                // Extract the folder name from the first file's webkitRelativePath.
                const firstFile = this.folderInput.files[0];
                const pathParts = firstFile.webkitRelativePath.split("/");
                this.properties.folder = pathParts[0]; // Selected folder name.
                // Update the label widget with the new folder name.
                if (this.folderLabelWidget) {
                    this.folderLabelWidget.value = this.properties.folder;
                }
                // Optionally trigger a node update.
                this.setDirtyCanvas(true);
            }
        });

        // Add a widget button that displays "Choose Folder" on the node.
        // When clicked, it triggers the hidden file input's click event.
        this.addWidget("button", "Choose Folder", "", () => {
            this.folderInput.click();
        });

        // Add a read-only text widget to display the current folder selection.
        // This acts as a label.
        this.folderLabelWidget = this.addWidget("text", "Current Folder", this.properties.folder, () => { }, { disabled: true });
    }

    // onExecute() {
    // Output the selected folder (name) on every execution cycle.
    // this.setOutputData(0, this.properties.folder);
    // }
}

LiteGraph.registerNodeType("input/folder_picker", FolderPickerNode);
