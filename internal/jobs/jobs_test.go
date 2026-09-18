package jobs

import (
	"testing"
	"time"

	"github.com/artemnih/WFLite/internal/plugins"
	"github.com/artemnih/WFLite/internal/workflow"
)

func TestStartAndDone(t *testing.T) {
	m := New(&workflow.Runner{Plugins: &plugins.Store{Dir: t.TempDir()}, BaseDir: t.TempDir()})
	job, err := m.Start(workflow.Graph{
		Nodes: []workflow.Node{{ID: "1", Type: "input/folder_picker"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if job.ID == "" {
		t.Fatal("empty id")
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		got := m.Get(job.ID)
		if got == nil {
			t.Fatal("missing job")
		}
		if got.Status == StatusDone {
			if got.Result == nil || !got.Result.Success {
				t.Fatalf("%+v", got)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("timeout status=%s", got.Status)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestGetAndStopMissing(t *testing.T) {
	m := New(&workflow.Runner{Plugins: &plugins.Store{Dir: t.TempDir()}, BaseDir: t.TempDir()})
	if m.Get("nope") != nil {
		t.Fatal("expected nil")
	}
	if m.Stop("nope") {
		t.Fatal("expected false")
	}
}

func TestStopCompletedJob(t *testing.T) {
	m := New(&workflow.Runner{Plugins: &plugins.Store{Dir: t.TempDir()}, BaseDir: t.TempDir()})
	job, err := m.Start(workflow.Graph{
		Nodes: []workflow.Node{{ID: "1", Type: "input/folder_picker"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for m.Get(job.ID).Status == StatusRunning {
		if time.Now().After(deadline) {
			t.Fatal("timeout")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if !m.Stop(job.ID) {
		t.Fatal("stop should find job")
	}
}
