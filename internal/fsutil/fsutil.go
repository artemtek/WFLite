package fsutil

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

type Entry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Dir  bool   `json:"dir"`
	Size int64  `json:"size"`
	Mod  string `json:"modified"`
}

type Listing struct {
	Path    string  `json:"path"`
	Parent  string  `json:"parent"`
	Entries []Entry `json:"entries"`
}

func HomeDir() (string, error) {
	return os.UserHomeDir()
}

func WorkflowsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "lite-workflows"), nil
}

func List(path string) (*Listing, error) {
	if path == "" {
		home, err := HomeDir()
		if err != nil {
			return nil, err
		}
		path = home
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if !st.IsDir() {
		return nil, fmt.Errorf("not a directory: %s", abs)
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		out = append(out, Entry{
			Name: name,
			Path: filepath.Join(abs, name),
			Dir:  e.IsDir(),
			Size: info.Size(),
			Mod:  info.ModTime().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Dir != out[j].Dir {
			return out[i].Dir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	parent := filepath.Dir(abs)
	if parent == abs {
		parent = ""
	}
	return &Listing{Path: abs, Parent: parent, Entries: out}, nil
}

func Roots() []string {
	if runtime.GOOS == "windows" {
		var roots []string
		for c := 'A'; c <= 'Z'; c++ {
			p := string(c) + `:\`
			if st, err := os.Stat(p); err == nil && st.IsDir() {
				roots = append(roots, p)
			}
		}
		return roots
	}
	return []string{"/"}
}
