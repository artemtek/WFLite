package workflow

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/artemnih/WFLite/internal/plugins"
)

func sortedKeys(inputs map[int]string) []int {
	keys := make([]int, 0, len(inputs))
	for k := range inputs {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	return keys
}

type Command struct {
	Program   string
	Args      []string
	OutputDir string
}

func resolveInputs(node Node, g Graph, execDir string) map[int]string {
	inputs := map[int]string{}
	id := node.IntID()
	for _, l := range parseLinks(g.Links) {
		if l.TargetID != id {
			continue
		}
		src := nodeByID(g, l.SourceID)
		if src == nil {
			continue
		}
		if strings.HasPrefix(src.Type, "input/") {
			folder := ""
			if src.Properties != nil {
				folder, _ = src.Properties["folder"].(string)
			}
			if folder != "" {
				inputs[l.TargetSlot] = folder
			}
			continue
		}
		inputs[l.TargetSlot] = nodeOutputDir(execDir, src.IntID())
	}
	return inputs
}

func nodeOutputDir(execDir string, nodeID int) string {
	return filepath.Join(execDir, fmt.Sprintf("node-%d", nodeID))
}

func buildDockerCommand(node Node, inputs map[int]string, execDir string, plugin plugins.Plugin, containerName string) (Command, error) {
	outputDir := nodeOutputDir(execDir, node.IntID())
	args := []string{"run", "--rm", "--name", containerName}

	for _, idx := range sortedKeys(inputs) {
		path := inputs[idx]
		var inputDef *plugins.Input
		if idx >= 0 && idx < len(plugin.Inputs) {
			inputDef = &plugin.Inputs[idx]
		}
		mount := fmt.Sprintf("/input/%d", idx)
		if inputDef != nil {
			mount = "/input/" + inputDef.ID
		}
		args = append(args, "-v", path+":"+mount)
	}
	args = append(args, "-v", outputDir+":/output")

	var image string
	var commandArgs []string

	if plugin.DockerImage != "" {
		image = plugin.DockerImage
		for _, idx := range sortedKeys(inputs) {
			if idx >= 0 && idx < len(plugin.Inputs) {
				commandArgs = append(commandArgs, "/input/"+plugin.Inputs[idx].ID)
			}
		}
		if len(plugin.Outputs) > 0 {
			commandArgs = append(commandArgs, "/output")
		}
		for key, value := range node.Properties {
			if strings.HasPrefix(key, "_") || value == nil || value == "" {
				continue
			}
			commandArgs = append(commandArgs, fmt.Sprint(value))
		}
	} else if plugin.Command != nil {
		imageIndex := -1
		for i, arg := range plugin.Command.Args {
			if strings.Contains(arg, ":") || (strings.Contains(arg, "/") && !strings.HasPrefix(arg, "/")) {
				imageIndex = i
				break
			}
		}
		if imageIndex >= 0 {
			image = plugin.Command.Args[imageIndex]
			commandArgs = append([]string{}, plugin.Command.Args[imageIndex+1:]...)
		} else if len(plugin.Command.Args) > 2 {
			image = plugin.Command.Args[2]
			commandArgs = append([]string{}, plugin.Command.Args[3:]...)
		} else {
			return Command{}, fmt.Errorf("could not determine Docker image from plugin command (%s)", plugin.ID)
		}

		inputPathMap := map[string]string{}
		for idx := range inputs {
			if idx >= 0 && idx < len(plugin.Inputs) {
				id := plugin.Inputs[idx].ID
				inputPathMap[id] = "/input/" + id
			}
		}
		resolved := make([]string, 0, len(commandArgs))
		for _, arg := range commandArgs {
			s := arg
			for id, containerPath := range inputPathMap {
				s = strings.ReplaceAll(s, "{"+id+"}", containerPath)
				if s == "/input/"+id {
					s = containerPath
				}
			}
			for _, out := range plugin.Outputs {
				s = strings.ReplaceAll(s, "{"+out.ID+"}", "/output")
			}
			for key, value := range node.Properties {
				s = strings.ReplaceAll(s, "{"+key+"}", fmt.Sprint(value))
			}
			resolved = append(resolved, s)
		}
		commandArgs = resolved
	} else {
		return Command{}, fmt.Errorf("plugin must have either command or dockerImage")
	}

	args = append(args, image)
	args = append(args, commandArgs...)

	program := "docker"
	if plugin.Command != nil && plugin.Command.Program != "" {
		program = plugin.Command.Program
	}
	return Command{Program: program, Args: args, OutputDir: outputDir}, nil
}
