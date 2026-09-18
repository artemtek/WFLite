package fsutil

import (
	"os"
	"path/filepath"
	"testing"
)

func TestList(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".hidden"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	listing, err := List(dir)
	if err != nil {
		t.Fatal(err)
	}
	if listing.Path != dir {
		t.Fatalf("path=%s", listing.Path)
	}
	if listing.Parent == "" {
		t.Fatal("expected parent")
	}
	names := map[string]bool{}
	for _, e := range listing.Entries {
		names[e.Name] = e.Dir
	}
	if !names["sub"] || names["a.txt"] {
		t.Fatalf("%v", names)
	}
	if _, ok := names[".hidden"]; ok {
		t.Fatal("hidden file listed")
	}
}

func TestListNotDir(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "f")
	if err := os.WriteFile(f, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := List(f); err == nil {
		t.Fatal("expected error")
	}
}

func TestHomeAndWorkflows(t *testing.T) {
	home, err := HomeDir()
	if err != nil || home == "" {
		t.Fatal(err, home)
	}
	wf, err := WorkflowsDir()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(wf) != "lite-workflows" {
		t.Fatalf("%s", wf)
	}
}
