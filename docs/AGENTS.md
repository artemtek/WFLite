# Building tools for Lite

This file is for coding agents (and humans) adding **plugins** — Dockerized nodes that appear in the workflow editor.

Lite is a local Go server plus web UI. It does not run plugin code itself. It runs `docker` on the host, mounts directories, and treats each plugin as a batch job: **read files from an input dir, write files to `/output`**.

## When you are asked to add a tool

Do all of these:

1. Create `custom-tools/{plugin-name}/` (source of truth: Dockerfile, script, JSON, README).
2. Copy the JSON to `plugins/{plugin-name}.json` (this is what the app loads).
3. Build the image locally: `docker build -t lite/{plugin-name}:latest custom-tools/{plugin-name}`.
4. Keep JSON in both places in sync. Do not register a plugin that has no image, or an image with no JSON.

Existing tools live under `custom-tools/` (copy, image-to-ascii, detect-objects, …). Match their layout.

## Layout

```
custom-tools/{plugin-name}/
  Dockerfile
  {script}                 # .sh, .py, …
  requirements.txt         # if Python
  {plugin-name}.json
  README.md

plugins/{plugin-name}.json   # identical JSON; required for the UI
```

**Names**

| What | Pattern | Example |
|------|---------|---------|
| Folder | `{plugin-name}` | `image-to-ascii` |
| Plugin `id` | `{plugin-name}` | `image-to-ascii` |
| Docker image | `lite/{plugin-name}:latest` | `lite/image-to-ascii:latest` |
| Registry JSON | `plugins/{plugin-name}.json` | `plugins/image-to-ascii.json` |

Do not put a personal or org prefix in plugin ids, image tags, or display names.

## Runtime contract

The executor always:

- Injects `docker run --rm --name …`
- Bind-mounts each connected **directory** input as `/input/{inputId}`
- Bind-mounts this node’s output as `/output`
- Does **not** need `-v` in plugin JSON (it adds mounts itself)

Script argv convention:

1. First argument: input directory (`/input/inputDir` or whatever the input `id` is)
2. Next: `/output`
3. Optional extra args from node properties (see JSON below)

The script must:

- Process **all** relevant files in the input directory (not a single hardcoded filename)
- Write results only under `/output`
- Exit `0` on success, non-zero on failure
- Log progress to stdout/stderr (the UI shows this)

Host output path after a run: `~/lite-workflows/{execution-id}/node-{id}/`.

### Manual smoke test

```bash
docker run --rm \
  -v /path/to/input:/input/inputDir \
  -v /path/to/output:/output \
  lite/{plugin-name}:latest \
  /input/inputDir /output
```

## Plugin JSON

The UI reads `plugins/*.json`. Either `dockerImage` **or** `command` is required.

**Prefer `dockerImage`** when argv is: input dirs (in input order) + `/output` + property values.

```json
{
  "id": "copy",
  "name": "Copy",
  "description": "Copies all files from the input directory to the output directory.",
  "version": "1.0.0",
  "inputs": [
    {
      "id": "inputDir",
      "name": "Input Directory",
      "type": "directory",
      "description": "Source files.",
      "required": true
    }
  ],
  "outputs": [
    {
      "id": "outputDir",
      "name": "Output Directory",
      "type": "directory",
      "description": "Copied files."
    }
  ],
  "dockerImage": "lite/copy:latest"
}
```

**Use `command`** when you need flags or placeholders (e.g. `--width {width}`):

```json
"command": {
  "program": "docker",
  "args": [
    "run",
    "--rm",
    "lite/image-to-ascii:latest",
    "/input/inputDir",
    "/output",
    "--width",
    "{width}"
  ]
}
```

Do not list `-v` mounts in `args`. The runner finds the image token in `args` and appends only the tokens after it, after substituting placeholders.

### Placeholders (command mode)

- `{inputId}` → `/input/{inputId}`
- `{outputId}` → `/output`
- `{propertyKey}` → the node’s property value (must match an input `id` used as a widget)

### `dockerImage` extra args

Directory inputs become `/input/{id}` in definition order, then `/output` if there are outputs, then each node property that does not start with `_` and is not empty.

### Input `type`

| Type | UI | Graph |
|------|----|--------|
| `directory` | — | Port; connect Folder Picker or another node’s directory output |
| `text` / `string` | text (optional `ui.multiline`) | Property / widget |
| `number` | number | Property / widget |
| `boolean` | toggle | Property / widget |

`ui.control`: `text` \| `number` \| `toggle` \| `combo` \| `slider`.  
`ui.options`: combo choices.  
`ui.visibleWhen`: expression for conditional widgets.

### Output `type`

`directory` (usual; chainable), `file`, `string`.

## Dockerfile

**Bash**

```dockerfile
FROM alpine:latest
RUN apk add --no-cache bash
COPY script.sh /usr/local/bin/script.sh
RUN chmod +x /usr/local/bin/script.sh
ENTRYPOINT ["/usr/local/bin/script.sh"]
```

**Python**

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY script.py /usr/local/bin/script.py
RUN chmod +x /usr/local/bin/script.py
ENTRYPOINT ["python", "/usr/local/bin/script.py"]
```

Pitfalls:

- `libgl1-mesa-glx` is deprecated; use `libgl1` or omit
- Prefer Pillow over `opencv-python` unless you need OpenCV
- Always `rm -rf /var/lib/apt/lists/*` after apt
- Image tag in JSON must match `docker build -t`

## Script sketches

**Bash** (`copy.sh`):

```bash
#!/bin/bash
set -euo pipefail
INPUT_DIR="${1:-/input/inputDir}"
OUTPUT_DIR="${2:-/output}"
mkdir -p "$OUTPUT_DIR"
cp -r "$INPUT_DIR"/. "$OUTPUT_DIR/"
```

**Python**:

```python
import sys
from pathlib import Path

def main():
    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    # process every file in input_dir; write under output_dir

if __name__ == "__main__":
    main()
```

## Agent checklist

- [ ] Folder name, image tag, plugin `id`, and `plugins/*.json` filename all agree
- [ ] JSON copied to `plugins/`, not only `custom-tools/`
- [ ] Script takes input dir then `/output`; writes only to output
- [ ] Local `docker build` succeeded
- [ ] Manual `docker run` with two volume mounts succeeded
- [ ] README in `custom-tools/{plugin-name}/` describes inputs/outputs and the build command
- [ ] Did not add Electron, Node, or extra icon assets
- [ ] Did not commit secrets or huge model blobs if they can be downloaded at build time

The workflow UI picks up new JSON from `plugins/` on the next plugin list fetch; the Docker image must already exist on the machine that runs Lite.
