package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/artemnih/WFLite/internal/server"
)

//go:embed all:web
var webFS embed.FS

func main() {
	addr := flag.String("addr", server.ListenAddr(), "listen address (host:port)")
	pluginDir := flag.String("plugins", "", "plugins directory")
	noOpen := flag.Bool("no-open", false, "do not open the browser")
	flag.Parse()

	web, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	dir := *pluginDir
	if dir == "" {
		dir = findPluginsDir()
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		log.Fatal(err)
	}

	srv := server.New(abs, web)
	url := "http://" + *addr + "/"
	fmt.Printf("Lite running at %s\n", url)
	fmt.Printf("Plugins: %s\n", abs)

	go func() {
		if *noOpen {
			return
		}
		time.Sleep(300 * time.Millisecond)
		openBrowser(url)
	}()

	log.Fatal(http.ListenAndServe(*addr, srv.Handler()))
}

func findPluginsDir() string {
	if d := os.Getenv("LITE_PLUGINS"); d != "" {
		return d
	}
	if st, err := os.Stat("plugins"); err == nil && st.IsDir() {
		return "plugins"
	}
	exe, err := os.Executable()
	if err == nil {
		cand := filepath.Join(filepath.Dir(exe), "plugins")
		if st, err := os.Stat(cand); err == nil && st.IsDir() {
			return cand
		}
	}
	return "plugins"
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
