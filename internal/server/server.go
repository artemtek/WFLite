package server

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/artemnih/WFLite/internal/fsutil"
	"github.com/artemnih/WFLite/internal/jobs"
	"github.com/artemnih/WFLite/internal/plugins"
	"github.com/artemnih/WFLite/internal/workflow"
)

type Server struct {
	Plugins *plugins.Store
	Jobs    *jobs.Manager
	Web     fs.FS
}

func New(pluginDir string, web fs.FS) *Server {
	store := &plugins.Store{Dir: pluginDir}
	runner := &workflow.Runner{Plugins: store}
	return &Server{
		Plugins: store,
		Jobs:    jobs.New(runner),
		Web:     web,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/plugins", s.listPlugins)
	mux.HandleFunc("POST /api/plugins", s.savePlugin)
	mux.HandleFunc("DELETE /api/plugins", s.deletePlugin)
	mux.HandleFunc("POST /api/plugins/validate", s.validatePlugin)
	mux.HandleFunc("POST /api/plugins/fetch", s.fetchPlugin)
	mux.HandleFunc("POST /api/plugins/fetch-bulk", s.fetchPluginsBulk)
	mux.HandleFunc("POST /api/plugins/bulk", s.savePluginsBulk)
	mux.HandleFunc("POST /api/workflows/run", s.runWorkflow)
	mux.HandleFunc("GET /api/jobs/{id}", s.getJob)
	mux.HandleFunc("POST /api/jobs/{id}/stop", s.stopJob)
	mux.HandleFunc("POST /api/workflows/stop", s.stopAll)
	mux.HandleFunc("GET /api/fs", s.listFS)
	mux.HandleFunc("GET /api/fs/home", s.homeFS)
	mux.HandleFunc("GET /api/fs/workflows", s.workflowsFS)
	mux.HandleFunc("GET /api/fs/roots", s.rootsFS)
	mux.Handle("/", http.FileServer(http.FS(s.Web)))
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) listPlugins(w http.ResponseWriter, r *http.Request) {
	list, err := s.Plugins.List()
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if list == nil {
		list = []plugins.Plugin{}
	}
	writeJSON(w, 200, list)
}

func (s *Server) savePlugin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Plugin   plugins.Plugin `json:"plugin"`
		Filename string         `json:"filename"`
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	if err := json.Unmarshal(raw, &body); err != nil || body.Plugin.ID == "" {
		var p plugins.Plugin
		if err2 := json.Unmarshal(raw, &p); err2 != nil {
			writeErr(w, 400, "invalid plugin JSON")
			return
		}
		body.Plugin = p
	}
	saved, err := s.Plugins.Save(body.Plugin, body.Filename)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, saved)
}

func (s *Server) deletePlugin(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		writeErr(w, 400, "filename required")
		return
	}
	if err := s.Plugins.Delete(filename); err != nil {
		writeErr(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"success": true})
}

func (s *Server) validatePlugin(w http.ResponseWriter, r *http.Request) {
	var p plugins.Plugin
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, plugins.Validate(p))
}

func (s *Server) fetchPlugin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		writeErr(w, 400, "url required")
		return
	}
	p, err := fetchJSON(body.URL)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, p)
}

func (s *Server) fetchPluginsBulk(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URLs []string `json:"urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	type item struct {
		Success bool            `json:"success"`
		URL     string          `json:"url"`
		Plugin  json.RawMessage `json:"plugin,omitempty"`
		Error   string          `json:"error,omitempty"`
	}
	var results []item
	for _, u := range body.URLs {
		p, err := fetchJSON(u)
		if err != nil {
			results = append(results, item{Success: false, URL: u, Error: err.Error()})
			continue
		}
		results = append(results, item{Success: true, URL: u, Plugin: p})
	}
	writeJSON(w, 200, results)
}

func (s *Server) savePluginsBulk(w http.ResponseWriter, r *http.Request) {
	var list []plugins.Plugin
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	type item struct {
		Success  bool   `json:"success"`
		Plugin   string `json:"plugin"`
		Filename string `json:"filename,omitempty"`
		Error    string `json:"error,omitempty"`
	}
	var results []item
	for _, p := range list {
		saved, err := s.Plugins.Save(p, "")
		name := p.ID
		if name == "" {
			name = p.Name
		}
		if err != nil {
			results = append(results, item{Success: false, Plugin: name, Error: err.Error()})
			continue
		}
		results = append(results, item{Success: true, Plugin: name, Filename: saved.Filename})
	}
	writeJSON(w, 200, results)
}

func (s *Server) runWorkflow(w http.ResponseWriter, r *http.Request) {
	var g workflow.Graph
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	job, err := s.Jobs.Start(g)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, job)
}

func (s *Server) getJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	job := s.Jobs.Get(id)
	if job == nil {
		writeErr(w, 404, "job not found")
		return
	}
	writeJSON(w, 200, job)
}

func (s *Server) stopJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !s.Jobs.Stop(id) {
		writeErr(w, 404, "job not found")
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "message": "stopped"})
}

func (s *Server) stopAll(w http.ResponseWriter, r *http.Request) {
	n := s.Jobs.StopAll()
	writeJSON(w, 200, map[string]any{"success": true, "killedCount": n, "message": fmt.Sprintf("Killed %d process(es)", n)})
}

func (s *Server) listFS(w http.ResponseWriter, r *http.Request) {
	listing, err := fsutil.List(r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, listing)
}

func (s *Server) homeFS(w http.ResponseWriter, r *http.Request) {
	home, err := fsutil.HomeDir()
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"path": home})
}

func (s *Server) workflowsFS(w http.ResponseWriter, r *http.Request) {
	dir, err := fsutil.WorkflowsDir()
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"path": dir})
}

func (s *Server) rootsFS(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"roots": fsutil.Roots()})
}

func fetchJSON(url string) (json.RawMessage, error) {
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return nil, fmt.Errorf("invalid url")
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("fetch failed: %s", resp.Status)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if !json.Valid(raw) {
		return nil, fmt.Errorf("response is not JSON")
	}
	return raw, nil
}

func ListenAddr() string {
	if v := os.Getenv("LITE_ADDR"); v != "" {
		return v
	}
	return "127.0.0.1:7474"
}
