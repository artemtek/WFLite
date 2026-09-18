package jobs

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/artemnih/WFLite/internal/workflow"
)

type Status string

const (
	StatusQueued  Status = "queued"
	StatusRunning Status = "running"
	StatusDone    Status = "done"
	StatusError   Status = "error"
	StatusStopped Status = "stopped"
)

type Job struct {
	ID     string              `json:"id"`
	Status Status              `json:"status"`
	Log    string              `json:"log"`
	Error  string              `json:"error,omitempty"`
	Result *workflow.RunResult `json:"result,omitempty"`

	cancel context.CancelFunc `json:"-"`
}

type Manager struct {
	mu   sync.Mutex
	jobs map[string]*Job
	run  *workflow.Runner
}

func New(run *workflow.Runner) *Manager {
	return &Manager{jobs: map[string]*Job{}, run: run}
}

func (m *Manager) Start(g workflow.Graph) (*Job, error) {
	id := newID()
	ctx, cancel := context.WithCancel(context.Background())
	job := &Job{ID: id, Status: StatusRunning, cancel: cancel}

	m.mu.Lock()
	m.jobs[id] = job
	m.mu.Unlock()

	go func() {
		res, err := m.run.Run(ctx, g, func(line string) {
			m.appendLog(id, line)
		}, id)
		m.mu.Lock()
		defer m.mu.Unlock()
		j := m.jobs[id]
		if j == nil {
			return
		}
		j.Result = res
		if err != nil {
			if ctx.Err() != nil {
				j.Status = StatusStopped
				j.Error = "stopped"
				return
			}
			j.Status = StatusError
			j.Error = err.Error()
			return
		}
		if res != nil && !res.Success {
			j.Status = StatusError
		} else {
			j.Status = StatusDone
		}
	}()
	return m.Get(id), nil
}

func (m *Manager) Get(id string) *Job {
	m.mu.Lock()
	defer m.mu.Unlock()
	j := m.jobs[id]
	if j == nil {
		return nil
	}
	cp := *j
	cp.cancel = nil
	return &cp
}

func (m *Manager) Stop(id string) bool {
	m.mu.Lock()
	j := m.jobs[id]
	m.mu.Unlock()
	if j == nil {
		return false
	}
	if j.cancel != nil {
		j.cancel()
	}
	workflow.KillDockerPrefix(id)
	m.mu.Lock()
	if j.Status == StatusRunning {
		j.Status = StatusStopped
	}
	m.mu.Unlock()
	return true
}

func (m *Manager) StopAll() int {
	m.mu.Lock()
	ids := make([]string, 0, len(m.jobs))
	for id, j := range m.jobs {
		if j.Status == StatusRunning {
			ids = append(ids, id)
		}
	}
	m.mu.Unlock()
	for _, id := range ids {
		m.Stop(id)
	}
	return len(ids)
}

func (m *Manager) appendLog(id, line string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j := m.jobs[id]
	if j == nil {
		return
	}
	if j.Log != "" {
		j.Log += "\n"
	}
	j.Log += line
}

func newID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format("150405.000")))
	}
	return hex.EncodeToString(b)
}
