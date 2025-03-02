function createLiteGraphNodeFromJSON(json) {

    class CustomNode {

        // LiteGraph properties
        properties = {};

        // stash of widgets to remove when visibleWhen changes
        widgetStash = new Map(); // { id: { index, widget } }

        // functions to evaluate the visibleWhen expressions
        visibleWhenFunctions = new Map();

        constructor() {

            // Store the command template if provided.
            if (json.command) {
                this.command = json.command;
            }

            // add to properties
            this.properties["command"] = json.command;

            // Process outputs.
            if (json.outputs) {
                json.outputs.forEach((output) => {
                    this.addOutput(output.name, output.type);
                });
            }

            // Process inputs.
            if (json.inputs) {

                // convert expressions to functions here once
                // rather than on each change
                const visibleWhenExpressions = new Map();

                json.inputs.forEach((input) => {

                    // add to properties
                    this.properties[input.id] = input.default || "";

                    // if input is directory, add input so we can connect to
                    // other nodes that output directories
                    if (input.type === "directory") {
                        this.addInput(input.name, input.type);
                        return;
                    }

                    let ui = input.ui || undefined;

                    // if no UI is specified, create one from the type
                    if (!ui) {
                        switch (input.type) {

                            case "number":
                                ui = { control: "number" };
                                break;
                            case "boolean":
                                ui = { control: "toggle" };
                                break;
                            case "slider":
                                ui = { control: "slider" };
                                break;
                            default:
                            case "text":
                                ui = { control: "text" };
                                break;
                        }
                    }


                    // add a corresponding widget.
                    let widget;
                    switch (ui.control) {
                        case "text":
                            const { multiline } = input.ui || {};
                            widget = this.addWidget("text", input.name, input.default || "", (v) => {
                                this.properties[input.id] = v;
                            }, { multiline });
                            break;
                        case "number":
                            widget = this.addWidget("number", input.name, input.default, (v) => {
                                this.properties[input.id] = v;
                            });
                            break;
                        case "toggle":
                            const config = input.config || { on: "On", off: "Off" };
                            widget = this.addWidget("toggle", input.name, input.default || false, (v) => {
                                this.properties[input.id] = v;
                            }, config);
                            break;
                        case "combo":
                            widget = this.addWidget("combo", input.name, input.default, (v) => {
                                this.properties[input.id] = v;
                            }, { values: ui.options });
                            break;
                        case "slider":
                            widget = this.addWidget("slider", input.name, input.default, (v) => {
                                this.properties[input.id] = v;
                            }, { min: ui.min || 0, max: ui.max || 1 });
                            break;
                        default:
                            break;
                    }

                    // if widget ui has a visibleWhen property, we need to check it on each change
                    if (ui.visibleWhen) {
                        console.log("visibleWhen", ui.visibleWhen);
                        visibleWhenExpressions.set(input.id, ui.visibleWhen);
                    }

                    widget.id = input.id;
                    const callback = widget.callback;
                    widget.callback = (v) => {
                        callback(v);
                        this.updateValue();
                    };
                });

                // now that all properties are set, we can convert the visibleWhen expressions to functions
                const keys = Object.keys(this.properties);
                visibleWhenExpressions.forEach((expression, key) => {
                    const func = new Function(...keys, "return " + expression + ";");
                    this.visibleWhenFunctions.set(key, func);
                });
            }




            // this.removeWidget("showAdvanced1");
        }



        updateValue() {
            const properties = this.properties;
            this.visibleWhenFunctions.forEach((func, key) => {

                // first we get all the keys that are used in the expression
                // so we dont have to use expresions like "properties.showAdvanced1"
                const keys = Object.keys(properties);
                const values = keys.map((key) => properties[key]);

                // evaluate the function with the values
                const result = func(...values);

                if (result) {
                    this.removeWidget(key);
                } else {
                    // this.addWidget(key);
                    // add widget back at same index
                    const stash = this.widgetStash.get(key);
                    if (stash) {
                        // restore widget
                        this.widgets.splice(stash.index, 0, stash.widget);

                        // restore property value
                        this.properties[key] = stash.value;

                        // remove from stash
                        this.widgetStash.delete(key);
                    }
                }

            });


        }

        removeWidget(id) {
            const index = this.widgets.findIndex((widget) => widget.id === id);
            if (index !== -1) {
                const widget = this.widgets.splice(index, 1)[0];
                this.properties[id] = undefined;
                this.widgetStash.set(id, { index, widget });
            } else {
                console.log("widget not found", id);
            }
        }

    }

    // Set the title and description of the node.
    CustomNode.title = json.name;
    CustomNode.desc = json.description;

    // Register the node type using the provided ID.
    LiteGraph.registerNodeType("plugin/" + json.id, CustomNode);
    console.log("Registered node type:", "plugin/" + json.id);
}