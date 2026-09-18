package workflow

import (
	"context"
	"encoding/json"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/artemnih/WFLite/internal/plugins"
)

func TestSequence(t *testing.T) {
	g := Graph{
		Nodes: []Node{
			{ID: "1", Type: "input/folder_picker"},
			{ID: "2", Type: "plugin/artemtek-copy"},
		},
		Links: []json.RawMessage{json.RawMessage(`[1,1,0,2,0,"directory"]`)},
	}
	seq, err := sequence(g)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(seq, []int{1, 2}) {
		t.Fatalf("seq=%v", seq)
	}
}

func TestSequenceObjectLinks(t *testing.T) {
	g := Graph{
		Nodes: []Node{
			{ID: "1", Type: "input/folder_picker"},
			{ID: "2", Type: "plugin/x"},
		},
		Links: []json.RawMessage{json.RawMessage(`{"origin_id":1,"target_id":2,"target_slot":0}`)},
	}
	seq, err := sequence(g)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(seq, []int{1, 2}) {
		t.Fatalf("seq=%v", seq)
	}
}

func TestSequenceDiamond(t *testing.T) {
	g := Graph{
		Nodes: []Node{
			{ID: "1", Type: "a"},
			{ID: "2", Type: "b"},
			{ID: "3", Type: "c"},
			{ID: "4", Type: "d"},
		},
		Links: []json.RawMessage{
			json.RawMessage(`[1,1,0,2,0,"t"]`),
			json.RawMessage(`[2,1,0,3,0,"t"]`),
			json.RawMessage(`[3,2,0,4,0,"t"]`),
			json.RawMessage(`[4,3,0,4,1,"t"]`),
		},
	}
	seq, err := sequence(g)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(seq, []int{1, 2, 3, 4}) {
		t.Fatalf("seq=%v", seq)
	}
}

func TestSequenceCycleHasNoStart(t *testing.T) {
	g := Graph{
		Nodes: []Node{{ID: "1", Type: "a"}, {ID: "2", Type: "b"}},
		Links: []json.RawMessage{
			json.RawMessage(`[1,1,0,2,0,"t"]`),
			json.RawMessage(`[2,2,0,1,0,"t"]`),
		},
	}
	_, err := sequence(g)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestBuildDockerCopy(t *testing.T) {
	p := plugins.Plugin{
		ID:          "artemtek-copy",
		DockerImage: "artemtek/copy:latest",
		Inputs:      []plugins.Input{{ID: "inputDir", Type: "directory"}},
		Outputs:     []plugins.Output{{ID: "outputDir"}},
	}
	node := Node{ID: "2", Type: "plugin/artemtek-copy", Properties: map[string]any{"_command": "x"}}
	cmd, err := buildDockerCommand(node, map[int]string{0: "/tmp/in"}, "/tmp/exec", p, "lite-test-n2")
	if err != nil {
		t.Fatal(err)
	}
	if cmd.Program != "docker" {
		t.Fatalf("program=%s", cmd.Program)
	}
	if filepath.Base(cmd.OutputDir) != "node-2" {
		t.Fatalf("output=%s", cmd.OutputDir)
	}
	want := []string{"run", "--rm", "--name", "lite-test-n2", "-v", "/tmp/in:/input/inputDir", "-v", cmd.OutputDir + ":/output", "artemtek/copy:latest", "/input/inputDir", "/output"}
	if !reflect.DeepEqual(cmd.Args, want) {
		t.Fatalf("args=%v want=%v", cmd.Args, want)
	}
}

func TestBuildDockerCommandPlaceholders(t *testing.T) {
	p := plugins.Plugin{
		ID: "echo",
		Command: &plugins.Command{
			Program: "docker",
			Args:    []string{"run", "--rm", "alpine:latest", "echo", "{msg}", "/input/inputDir"},
		},
		Inputs:  []plugins.Input{{ID: "inputDir", Type: "directory"}},
		Outputs: []plugins.Output{{ID: "outputDir"}},
	}
	node := Node{ID: "3", Properties: map[string]any{"msg": "hi"}}
	cmd, err := buildDockerCommand(node, map[int]string{0: "/data"}, "/exec", p, "lite-echo")
	if err != nil {
		t.Fatal(err)
	}
	if cmd.Args[len(cmd.Args)-2] != "hi" || cmd.Args[len(cmd.Args)-1] != "/input/inputDir" {
		t.Fatalf("args=%v", cmd.Args)
	}
}

func TestResolveInputsFromFolderPicker(t *testing.T) {
	g := Graph{
		Nodes: []Node{
			{ID: "1", Type: "input/folder_picker", Properties: map[string]any{"folder": "/photos"}},
			{ID: "2", Type: "plugin/artemtek-copy"},
		},
		Links: []json.RawMessage{json.RawMessage(`[1,1,0,2,0,"directory"]`)},
	}
	got := resolveInputs(*nodeByID(g, 2), g, "/exec")
	if got[0] != "/photos" {
		t.Fatalf("%v", got)
	}
}

func TestRunSkipsInputNodes(t *testing.T) {
	dir := t.TempDir()
	store := &plugins.Store{Dir: dir}
	r := &Runner{Plugins: store, BaseDir: t.TempDir()}
	g := Graph{
		Name:  "t",
		Nodes: []Node{{ID: "1", Type: "input/folder_picker", Properties: map[string]any{"folder": dir}}},
	}
	res, err := r.Run(context.Background(), g, nil, "job1")
	if err != nil {
		t.Fatal(err)
	}
	if !res.Success || len(res.Results) != 0 {
		t.Fatalf("%+v", res)
	}
}

func TestRunMissingPlugin(t *testing.T) {
	r := &Runner{Plugins: &plugins.Store{Dir: t.TempDir()}, BaseDir: t.TempDir()}
	g := Graph{Nodes: []Node{{ID: "1", Type: "plugin/nope"}}}
	res, err := r.Run(context.Background(), g, nil, "job1")
	if err != nil {
		t.Fatal(err)
	}
	if res.Success || len(res.Errors) == 0 {
		t.Fatalf("%+v", res)
	}
}
