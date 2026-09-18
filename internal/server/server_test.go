package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/artemnih/WFLite/internal/jobs"
	"github.com/artemnih/WFLite/internal/plugins"
	"github.com/artemnih/WFLite/internal/workflow"
)

func testServer(t *testing.T) *httptest.Server {
	t.Helper()
	web := fstest.MapFS{"index.html": {Data: []byte("ui")}}
	store := &plugins.Store{Dir: t.TempDir()}
	s := &Server{
		Plugins: store,
		Jobs:    jobs.New(&workflow.Runner{Plugins: store, BaseDir: t.TempDir()}),
		Web:     web,
	}
	return httptest.NewServer(s.Handler())
}

func TestHealthAndIndex(t *testing.T) {
	ts := testServer(t)
	defer ts.Close()

	res, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}

	res, err = http.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || string(body) != "ui" {
		t.Fatalf("%s %s", res.Status, body)
	}
}

func TestPluginsCRUDAndValidate(t *testing.T) {
	ts := testServer(t)
	defer ts.Close()

	res, err := http.Get(ts.URL + "/api/plugins")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var empty []plugins.Plugin
	if err := json.NewDecoder(res.Body).Decode(&empty); err != nil {
		t.Fatal(err)
	}
	if len(empty) != 0 {
		t.Fatalf("%v", empty)
	}

	payload := `{"id":"test-echo","name":"Echo","version":"1","description":"d","dockerImage":"alpine:latest"}`
	res, err = http.Post(ts.URL+"/api/plugins", "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}

	res, err = http.Get(ts.URL + "/api/plugins")
	if err != nil {
		t.Fatal(err)
	}
	var list []plugins.Plugin
	if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if len(list) != 1 || list[0].ID != "test-echo" {
		t.Fatalf("%v", list)
	}

	res, err = http.Post(ts.URL+"/api/plugins/validate", "application/json", strings.NewReader(`{"id":"x"}`))
	if err != nil {
		t.Fatal(err)
	}
	var v plugins.Validation
	if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if v.Valid {
		t.Fatal("expected invalid")
	}

	req, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/plugins?filename=test-echo.json", nil)
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
}

func TestFSList(t *testing.T) {
	ts := testServer(t)
	defer ts.Close()

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "n.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	res, err := http.Get(ts.URL + "/api/fs?path=" + dir)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	var listing struct {
		Path    string `json:"path"`
		Entries []struct {
			Name string `json:"name"`
		} `json:"entries"`
	}
	if err := json.NewDecoder(res.Body).Decode(&listing); err != nil {
		t.Fatal(err)
	}
	if listing.Path != dir || len(listing.Entries) != 1 || listing.Entries[0].Name != "n.txt" {
		t.Fatalf("%+v", listing)
	}
}

func TestWorkflowRunAndPoll(t *testing.T) {
	ts := testServer(t)
	defer ts.Close()

	body := `{"nodes":[{"id":1,"type":"input/folder_picker","properties":{"folder":"/tmp"}}],"links":[]}`
	res, err := http.Post(ts.URL+"/api/workflows/run", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	var job jobs.Job
	if err := json.NewDecoder(res.Body).Decode(&job); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if job.ID == "" {
		t.Fatal("empty job id")
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		res, err = http.Get(ts.URL + "/api/jobs/" + job.ID)
		if err != nil {
			t.Fatal(err)
		}
		var got jobs.Job
		if err := json.NewDecoder(res.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if got.Status == jobs.StatusDone {
			if got.Result == nil || !got.Result.Success {
				t.Fatalf("%+v", got)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("timeout %+v", got)
		}
		time.Sleep(20 * time.Millisecond)
	}

	res, err = http.Get(ts.URL + "/api/jobs/missing")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatal(res.Status)
	}
}

func TestFetchRejectsBadURL(t *testing.T) {
	ts := testServer(t)
	defer ts.Close()
	res, err := http.Post(ts.URL+"/api/plugins/fetch", "application/json", strings.NewReader(`{"url":"ftp://x"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatal(res.Status)
	}
}
