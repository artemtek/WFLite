package plugins

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Command struct {
	Program string   `json:"program"`
	Args    []string `json:"args"`
}

type Input struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required,omitempty"`
	Default     any    `json:"default,omitempty"`
	UI          any    `json:"ui,omitempty"`
}

type Output struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

type Plugin struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Version     string    `json:"version,omitempty"`
	Inputs      []Input   `json:"inputs,omitempty"`
	Outputs     []Output  `json:"outputs,omitempty"`
	DockerImage string    `json:"dockerImage,omitempty"`
	Command     *Command  `json:"command,omitempty"`
	Filename    string    `json:"filename,omitempty"`
	FilePath    string    `json:"filePath,omitempty"`
	Modified    time.Time `json:"modified,omitempty"`
	Enabled     bool      `json:"enabled,omitempty"`
}

type Validation struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

type Store struct {
	Dir string
}

func (s *Store) List() ([]Plugin, error) {
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.Dir)
	if err != nil {
		return nil, err
	}
	var out []Plugin
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		p, err := s.readFile(e.Name())
		if err != nil {
			continue
		}
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

func (s *Store) ByType() (map[string]Plugin, error) {
	list, err := s.List()
	if err != nil {
		return nil, err
	}
	m := make(map[string]Plugin, len(list))
	for _, p := range list {
		m["plugin/"+p.ID] = p
	}
	return m, nil
}

func (s *Store) Save(p Plugin, filename string) (Plugin, error) {
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return Plugin{}, err
	}
	if filename == "" {
		filename = p.ID + ".json"
	}
	if !strings.HasSuffix(filename, ".json") {
		filename += ".json"
	}
	path := filepath.Join(s.Dir, filepath.Base(filename))
	raw, err := json.MarshalIndent(stripListMeta(p), "", "  ")
	if err != nil {
		return Plugin{}, err
	}
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		return Plugin{}, err
	}
	return s.readFile(filepath.Base(path))
}

func (s *Store) Delete(filename string) error {
	path := filepath.Join(s.Dir, filepath.Base(filename))
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("plugin %s not found", filename)
	}
	return os.Remove(path)
}

func (s *Store) readFile(filename string) (Plugin, error) {
	path := filepath.Join(s.Dir, filename)
	raw, err := os.ReadFile(path)
	if err != nil {
		return Plugin{}, err
	}
	var p Plugin
	if err := json.Unmarshal(raw, &p); err != nil {
		return Plugin{}, err
	}
	st, err := os.Stat(path)
	if err != nil {
		return Plugin{}, err
	}
	if p.ID == "" {
		p.ID = strings.TrimSuffix(filename, ".json")
	}
	if p.Name == "" {
		p.Name = "Unnamed Plugin"
	}
	if p.Version == "" {
		p.Version = "1.0.0"
	}
	p.Filename = filename
	p.FilePath = path
	p.Modified = st.ModTime()
	p.Enabled = true
	return p, nil
}

func stripListMeta(p Plugin) Plugin {
	p.Filename = ""
	p.FilePath = ""
	p.Modified = time.Time{}
	p.Enabled = false
	return p
}

func Validate(p Plugin) Validation {
	v := Validation{Errors: []string{}, Warnings: []string{}}
	if p.ID == "" {
		v.Errors = append(v.Errors, `Plugin must have an "id" field`)
	}
	if p.Name == "" {
		v.Errors = append(v.Errors, `Plugin must have a "name" field`)
	}
	if p.Command == nil && p.DockerImage == "" {
		v.Errors = append(v.Errors, `Plugin must have either a "command" field or a "dockerImage" field`)
	}
	if p.Command != nil {
		if p.Command.Program == "" {
			v.Errors = append(v.Errors, `Command must have a "program" field`)
		}
		if p.Command.Args == nil {
			v.Errors = append(v.Errors, `Command must have an "args" array`)
		}
	}
	if p.Version == "" {
		v.Warnings = append(v.Warnings, `Plugin should have a "version" field`)
	}
	if p.Description == "" {
		v.Warnings = append(v.Warnings, `Plugin should have a "description" field`)
	}
	v.Valid = len(v.Errors) == 0
	return v
}
