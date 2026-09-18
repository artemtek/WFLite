# Lite

Local workflow editor for Dockerized tools. One binary serves a web UI on localhost and runs `docker` on your machine.

## Run

```bash
go run . -no-open
```

Then open http://127.0.0.1:7474/

Or build a single binary:

```bash
go build -o lite .
./lite
```

Flags:

- `-addr 127.0.0.1:7474` listen address
- `-plugins ./plugins` plugin JSON directory
- `-no-open` do not launch a browser

Requires Docker on `PATH` to execute workflows.

```bash
go test ./...
```

## UI

- **Workflow** — LiteGraph editor, start/stop runs, plugin manager
- **Files** — browse the host filesystem (folder picker + later, run outputs under `~/lite-workflows`)

## Plugins

JSON files in `plugins/` (see [docs/AGENTS.md](docs/AGENTS.md) for how to build tools). The server reads that directory next to the working directory, or next to the binary.
