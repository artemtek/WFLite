package workflow

import (
	"encoding/json"
	"fmt"
)

type Graph struct {
	Name  string            `json:"name"`
	Nodes []Node            `json:"nodes"`
	Links []json.RawMessage `json:"links"`
}

type Node struct {
	ID         json.Number    `json:"id"`
	Type       string         `json:"type"`
	Properties map[string]any `json:"properties"`
}

type link struct {
	SourceID   int
	TargetID   int
	TargetSlot int
}

func (n Node) IntID() int {
	id, _ := n.ID.Int64()
	return int(id)
}

func parseLinks(raw []json.RawMessage) []link {
	var out []link
	for _, item := range raw {
		var arr []any
		if err := json.Unmarshal(item, &arr); err == nil && len(arr) >= 5 {
			out = append(out, link{
				SourceID:   asInt(arr[1]),
				TargetID:   asInt(arr[3]),
				TargetSlot: asInt(arr[4]),
			})
			continue
		}
		var obj struct {
			OriginID   int `json:"origin_id"`
			TargetID   int `json:"target_id"`
			TargetSlot int `json:"target_slot"`
		}
		if err := json.Unmarshal(item, &obj); err == nil {
			out = append(out, link{
				SourceID:   obj.OriginID,
				TargetID:   obj.TargetID,
				TargetSlot: obj.TargetSlot,
			})
		}
	}
	return out
}

func asInt(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case json.Number:
		i, _ := n.Int64()
		return int(i)
	case int:
		return n
	default:
		return 0
	}
}

type simpleNode struct {
	ID  int
	In  []int
	Out []int
}

func sequence(g Graph) ([]int, error) {
	nodes := make([]simpleNode, 0, len(g.Nodes))
	index := map[int]int{}
	for i, n := range g.Nodes {
		id := n.IntID()
		nodes = append(nodes, simpleNode{ID: id})
		index[id] = i
	}
	for _, l := range parseLinks(g.Links) {
		si, sok := index[l.SourceID]
		ti, tok := index[l.TargetID]
		if !sok || !tok {
			continue
		}
		src := &nodes[si]
		dst := &nodes[ti]
		skip := false
		for _, id := range src.Out {
			if id == dst.ID {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		src.Out = append(src.Out, dst.ID)
		dst.In = append(dst.In, src.ID)
	}

	var next []simpleNode
	for _, n := range nodes {
		if len(n.In) == 0 {
			next = append(next, n)
		}
	}
	if len(next) == 0 {
		return nil, fmt.Errorf("no start node found")
	}

	var seq []int
	visited := map[int]bool{}
	byID := map[int]simpleNode{}
	for _, n := range nodes {
		byID[n.ID] = n
	}
	for len(next) > 0 {
		n := next[0]
		next = next[1:]
		seq = append(seq, n.ID)
		visited[n.ID] = true
		for _, nid := range n.Out {
			child := byID[nid]
			ready := true
			for _, in := range child.In {
				if !visited[in] {
					ready = false
					break
				}
			}
			if ready {
				next = append(next, child)
			}
		}
	}
	return seq, nil
}

func nodeByID(g Graph, id int) *Node {
	for i := range g.Nodes {
		if g.Nodes[i].IntID() == id {
			return &g.Nodes[i]
		}
	}
	return nil
}
