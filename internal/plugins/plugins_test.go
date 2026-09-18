package plugins

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidate(t *testing.T) {
	bad := Validate(Plugin{})
	if bad.Valid {
		t.Fatal("expected invalid")
	}
	if len(bad.Errors) < 3 {
		t.Fatalf("errors=%v", bad.Errors)
	}

	ok := Validate(Plugin{ID: "a", Name: "A", DockerImage: "img:1", Version: "1", Description: "d"})
	if !ok.Valid || len(ok.Errors) != 0 || len(ok.Warnings) != 0 {
		t.Fatalf("%+v", ok)
	}

	cmd := Validate(Plugin{ID: "a", Name: "A", Command: &Command{Program: "docker", Args: []string{}}})
	if !cmd.Valid {
		t.Fatalf("%+v", cmd)
	}
}

func TestStoreSaveListDelete(t *testing.T) {
	s := &Store{Dir: t.TempDir()}
	saved, err := s.Save(Plugin{
		ID:          "test-echo",
		Name:        "Echo",
		Version:     "1.0.0",
		Description: "hi",
		DockerImage: "alpine:latest",
	}, "")
	if err != nil {
		t.Fatal(err)
	}
	if saved.Filename != "test-echo.json" {
		t.Fatalf("filename=%s", saved.Filename)
	}

	list, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != "test-echo" {
		t.Fatalf("list=%v", list)
	}

	byType, err := s.ByType()
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := byType["plugin/test-echo"]; !ok {
		t.Fatal(byType)
	}

	if err := s.Delete("test-echo.json"); err != nil {
		t.Fatal(err)
	}
	list, err = s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("after delete %v", list)
	}
	if err := s.Delete("missing.json"); err == nil {
		t.Fatal("expected missing delete error")
	}
}

func TestListSkipsBrokenJSON(t *testing.T) {
	dir := t.TempDir()
	s := &Store{Dir: dir}
	if _, err := s.Save(Plugin{ID: "ok", Name: "Ok", DockerImage: "x:1"}, ""); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "broken.json"), []byte("{"), 0o644); err != nil {
		t.Fatal(err)
	}
	list, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != "ok" {
		t.Fatalf("%v", list)
	}
}
