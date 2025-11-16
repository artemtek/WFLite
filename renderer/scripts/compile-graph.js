/* link example 

[1, 1, 0, 2, 0, 'directory']

1: link ID
1: out-node ID
0: out-node output ID
2: in-node ID
0: in-node output ID
'directory': out name? in name? idk

*/

export function simplifyGraph(graph) {
    const simpleNodes = graph.nodes.map((n) => ({ id: n.id, in: [], out: [] }));

    const sourceNodeIdArrayIndex = 1;
    const targetNodeIdArrayIndex = 3;

    for (const link of graph.links) {
        const sourceNode = simpleNodes.find((n) => n.id === link[sourceNodeIdArrayIndex]);
        const targetNode = simpleNodes.find((n) => n.id === link[targetNodeIdArrayIndex]);

        if (sourceNode && targetNode) {
            // check if the link already exists, in case of duplicate links with different inlets
            if (sourceNode.out.includes(targetNode.id)) {
                continue;
            }

            sourceNode.out.push(targetNode.id);
            targetNode.in.push(sourceNode.id);
        }
    }

    return simpleNodes;
}


export function getSequence(simpleNodes) {
    const allNodes = simpleNodes.slice();
    const startNodes = allNodes.filter((n) => n.in.length === 0);

    if (startNodes.length === 0) {
        throw new Error('No start node found');
    }

    const nextNodes = startNodes;
    const sequnece = []; // number []
    const visitedNodes = new Set(); // new Set<number>()

    while (nextNodes.length > 0) {
        const node = nextNodes.shift();
        if (node) {
            sequnece.push(node.id);
            visitedNodes.add(node.id);
            const nextNodeIds = node.out;
            for (const nextNodeId of nextNodeIds) {
                const nextNode = simpleNodes.find((n) => n.id === nextNodeId);
                if (nextNode) {
                    if (nextNode.in.every((n) => visitedNodes.has(n))) {
                        nextNodes.push(nextNode);
                    }
                }
            }
        }
    }

    return sequnece;
}




export function compileGraph(graph) {
    const workflow = {};

    return workflow;
}