Reviewing the codebase to understand the current state and suggest next features.


[3 tools called]


Reviewing the todo list and key files to identify gaps:


[3 tools called]


Suggested next features, prioritized by impact and user value:

## High priority — core UX

0. **Storage strategy
   - for worfklows

1. **Plugin management UI**
   - Browse/install plugins from a registry
   - View installed plugins with details
   - Enable/disable plugins
   - Import plugins from file/URL
   - Currently plugins are only loaded from the `plugins/` folder

2. **Node palette/search**
   - Right-click or sidebar to add nodes
   - Search/filter available plugins
   - Group by category
   - Currently nodes are hardcoded in startup

3. **Workflow validation**
   - Validate before execution (required inputs, connection types, cycles)
   - Visual indicators for invalid nodes
   - Error messages for common issues

4. **Undo/redo**
   - History for node operations, connections, and property changes
   - Keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)

5. **Execution controls**
   - Pause/resume execution
   - Stop/cancel running workflows
   - Progress indicator per node
   - Currently execution runs to completion

## Medium priority — workflow features

6. **Sub-workflows/templates**
   - Save/load reusable sub-graphs
   - Create workflow templates
   - Nested workflows

7. **Variable/parameter management**
   - Global variables accessible across nodes
   - Environment variables
   - Parameterized workflows

8. **Conditional execution**
   - If/else nodes
   - Conditional branching based on outputs
   - Loops/iterators

9. **Execution history**
   - View past executions
   - Compare results
   - Re-run previous workflows
   - Execution logs are currently only in-memory

10. **Node grouping/annotation**
    - Group related nodes
    - Add notes/comments
    - Color-code nodes
    - Collapse/expand groups

## Lower priority — polish & export

11. **Export formats**
    - Export to CWL, WIC, Argo (from your todo)
    - Export as Docker Compose
    - Export as shell script

12. **Plugin development tools**
    - Plugin builder/validator
    - Test plugin execution
    - Plugin documentation generator

13. **UI improvements**
    - Custom menu (from your todo)
    - Keyboard shortcuts panel
    - Dark/light theme toggle
    - Zoom controls for canvas
    - Minimap/navigator

14. **Performance & monitoring**
    - Execution time per node
    - Resource usage monitoring
    - Workflow performance analytics

15. **Collaboration features**
    - Share workflows
    - Version control integration
    - Workflow comments/annotations

## Quick wins (start here)

- Node palette/search (#2)
- Undo/redo (#4)
- Execution history (#9)
- Workflow validation (#3)

Should I start with one of these? I recommend starting with the node palette/search, as it’s a core UX improvement.