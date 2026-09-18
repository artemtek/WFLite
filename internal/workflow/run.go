package workflow

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/artemnih/WFLite/internal/plugins"
)

type Result struct {
	NodeID    int    `json:"nodeId"`
	NodeType  string `json:"nodeType,omitempty"`
	Success   bool   `json:"success"`
	Output    string `json:"output,omitempty"`
	OutputDir string `json:"outputDir,omitempty"`
	Command   string `json:"command,omitempty"`
	Duration  int64  `json:"duration"`
	Error     string `json:"error,omitempty"`
}

type Timing struct {
	TotalDuration int64        `json:"totalDuration"`
	NodeTimings   []NodeTiming `json:"nodeTimings"`
}

type NodeTiming struct {
	NodeID   int    `json:"nodeId"`
	NodeType string `json:"nodeType"`
	Duration int64  `json:"duration"`
}

type RunResult struct {
	Success      bool     `json:"success"`
	ExecutionDir string   `json:"executionDir"`
	Results      []Result `json:"results"`
	Errors       []string `json:"errors"`
	Summary      string   `json:"summary"`
	Timing       Timing   `json:"timing"`
}

type LogFunc func(string)

type Runner struct {
	Plugins *plugins.Store
	BaseDir string
}

func (r *Runner) ExecDir(workflowName string) (string, error) {
	base := r.BaseDir
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, "lite-workflows")
	}
	name := "workflow"
	if workflowName != "" {
		name = sanitize(workflowName)
	}
	id := fmt.Sprintf("%d-%s-%d", time.Now().UnixMilli(), name, time.Now().UnixNano()%1e8)
	dir := filepath.Join(base, id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func sanitize(s string) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	out := b.String()
	if out == "" {
		return "workflow"
	}
	return out
}

func (r *Runner) Run(ctx context.Context, g Graph, log LogFunc, jobID string) (*RunResult, error) {
	start := time.Now()
	pluginMap, err := r.Plugins.ByType()
	if err != nil {
		return nil, err
	}
	execDir, err := r.ExecDir(g.Name)
	if err != nil {
		return nil, err
	}
	if log != nil {
		log("Execution directory: " + execDir)
	}

	seq, err := sequence(g)
	if err != nil {
		return nil, err
	}

	out := &RunResult{ExecutionDir: execDir, Results: []Result{}, Errors: []string{}}
	for _, id := range seq {
		node := nodeByID(g, id)
		if node == nil {
			continue
		}
		if strings.HasPrefix(node.Type, "input/") {
			if log != nil {
				log(fmt.Sprintf("Skipping input node %d", id))
			}
			continue
		}
		plugin, ok := pluginMap[node.Type]
		if !ok {
			msg := fmt.Sprintf("plugin definition not found for node type: %s", node.Type)
			out.Errors = append(out.Errors, msg)
			out.Results = append(out.Results, Result{NodeID: id, NodeType: node.Type, Success: false, Error: msg})
			continue
		}
		nodeStart := time.Now()
		if log != nil {
			log(fmt.Sprintf("Executing node %d (%s)", id, node.Type))
		}
		outputDir := nodeOutputDir(execDir, id)
		if err := os.MkdirAll(outputDir, 0o755); err != nil {
			return nil, err
		}
		inputs := resolveInputs(*node, g, execDir)
		cname := containerName(jobID, id)
		cmdSpec, err := buildDockerCommand(*node, inputs, execDir, plugin, cname)
		if err != nil {
			dur := time.Since(nodeStart).Milliseconds()
			out.Errors = append(out.Errors, err.Error())
			out.Results = append(out.Results, Result{NodeID: id, NodeType: node.Type, Success: false, Error: err.Error(), Duration: dur})
			continue
		}
		commandString := cmdSpec.Program + " " + strings.Join(cmdSpec.Args, " ")
		if log != nil {
			log("Command: " + commandString)
		}
		res, runErr := runCmd(ctx, cmdSpec.Program, cmdSpec.Args, execDir, log)
		dur := time.Since(nodeStart).Milliseconds()
		if runErr != nil {
			out.Errors = append(out.Errors, fmt.Sprintf("Node %d error: %s", id, runErr.Error()))
			out.Results = append(out.Results, Result{
				NodeID: id, NodeType: node.Type, Success: false, Error: runErr.Error(),
				Command: commandString, Duration: dur, OutputDir: outputDir,
			})
			continue
		}
		if !res.success {
			out.Errors = append(out.Errors, fmt.Sprintf("Node %d failed: %s", id, res.output))
		}
		out.Results = append(out.Results, Result{
			NodeID: id, NodeType: node.Type, Success: res.success,
			Output: res.output, OutputDir: outputDir, Command: commandString, Duration: dur,
		})
	}

	total := time.Since(start).Milliseconds()
	timings := make([]NodeTiming, 0, len(out.Results))
	for _, n := range out.Results {
		timings = append(timings, NodeTiming{NodeID: n.NodeID, NodeType: n.NodeType, Duration: n.Duration})
	}
	out.Success = len(out.Errors) == 0
	out.Summary = fmt.Sprintf("%d nodes executed, %d errors", len(out.Results), len(out.Errors))
	out.Timing = Timing{TotalDuration: total, NodeTimings: timings}
	return out, nil
}

type cmdResult struct {
	success bool
	output  string
	code    int
}

func runCmd(ctx context.Context, program string, args []string, dir string, log LogFunc) (cmdResult, error) {
	cmd := exec.CommandContext(ctx, program, args...)
	cmd.Dir = dir
	var buf bytes.Buffer
	cmd.Stdout = &logWriter{buf: &buf, log: log}
	cmd.Stderr = &logWriter{buf: &buf, log: log}
	err := cmd.Run()
	out := buf.String()
	if err != nil {
		if ctx.Err() != nil {
			return cmdResult{success: false, output: out, code: -1}, ctx.Err()
		}
		if ee, ok := err.(*exec.ExitError); ok {
			return cmdResult{success: false, output: out, code: ee.ExitCode()}, nil
		}
		return cmdResult{success: false, output: out, code: 1}, err
	}
	return cmdResult{success: true, output: out, code: 0}, nil
}

type logWriter struct {
	buf *bytes.Buffer
	log LogFunc
}

func (w *logWriter) Write(p []byte) (int, error) {
	w.buf.Write(p)
	if w.log != nil {
		w.log(strings.TrimRight(string(p), "\n"))
	}
	return len(p), nil
}

func containerName(jobID string, nodeID int) string {
	id := jobID
	if len(id) > 12 {
		id = id[:12]
	}
	return fmt.Sprintf("lite-%s-n%d", id, nodeID)
}

func KillDockerPrefix(jobID string) {
	if jobID == "" {
		return
	}
	prefix := "lite-" + jobID
	if len(jobID) > 12 {
		prefix = "lite-" + jobID[:12]
	}
	out, err := exec.Command("docker", "ps", "-q", "--filter", "name="+prefix).Output()
	if err != nil {
		return
	}
	ids := strings.Fields(string(out))
	for _, id := range ids {
		_ = exec.Command("docker", "kill", id).Run()
	}
}
