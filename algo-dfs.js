(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-dfs.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine } = window.Labyrinth;

    window.Labyrinth.registerAlgorithm({
        id: 'dfs',
        name: "Depth First Search",
        fields: [
            { id: 'edges', label: 'All Edges [(u,v),...]', type: 'graph' },
            { id: 'visited', label: 'Visited (Set/List)', type: 'any' },
            { id: 'stack', label: 'Recursion Stack (List)', type: 'any' },
            { id: 'parent', label: 'Parent Tree (Dict)', type: 'any' },
            { id: 'current', label: 'Current Node', type: 'any' }
        ],

        render(ctx, state, globals) {
            const edgeVar = state.mappings['edges'];
            if (!edgeVar) return;

            const allEdgesRaw = globals[edgeVar] || [];
            const visitedState = globals[state.mappings['visited']] || [];
            const stackState = globals[state.mappings['stack']] || [];
            const parentState = globals[state.mappings['parent']] || {};
            const currentNode = String(globals[state.mappings['current']]);

            // Robustly convert visited and stack to Sets for quick lookup
            const visitedSet = new Set(Array.from(visitedState).map(String));
            const stackSet = new Set(Array.from(stackState).map(String));

            // Build the DFS Tree edges
            const treeEdges = new Set();
            Object.entries(parentState).forEach(([node, p]) => {
                if (p !== null && p !== undefined) {
                    treeEdges.add(edgeKey(node, p));
                }
            });

            // 1. Draw All Edges
            allEdgesRaw.forEach(e => {
                if (!Array.isArray(e) || e.length < 2) return;
                const u = String(e[0]), v = String(e[1]);
                const p1 = state.nodePositions[u], p2 = state.nodePositions[v];
                if (!p1 || !p2) return;

                const key = edgeKey(u, v);
                let color = COLORS.edgeNone || '#cccccc';
                let width = 1.5;

                if (treeEdges.has(key)) {
                    color = COLORS.edgeAccept || '#4caf50'; // Green for DFS Tree
                    width = 3.5;
                }

                drawLine(p1, p2, color, width);
            });

            // 2. Draw Nodes
            Object.entries(state.nodePositions).forEach(([id, pos]) => {
                let fill = COLORS.nodeFill || '#ffffff';
                let stroke = COLORS.nodeStroke || '#333333';
                let label = "";

                if (id === currentNode) {
                    stroke = '#ff9800'; // Orange for the active recursion
                    fill = '#ffe0b2';
                    label = "Active";
                } else if (stackSet.has(id)) {
                    stroke = '#2196f3'; // Blue for nodes currently in stack
                    fill = '#bbdefb';
                    label = "In Stack";
                } else if (visitedSet.has(id)) {
                    stroke = COLORS.edgeAccept || '#4caf50'; // Green for finished nodes
                    fill = '#c8e6c9';
                    label = "Visited";
                }

                drawNode(pos, id, stroke, fill);

                // Draw Status Label
                if (label) {
                    ctx.fillStyle = stroke;
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(label, pos.x, pos.y - 18);
                }
            });

            // 3. Update Description
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (currentNode && currentNode !== "undefined") {
                    desc.innerHTML = `DFS: Currently exploring node <b>${currentNode}</b>.`;
                } else {
                    desc.innerHTML = `DFS Visualization. Map your variables (visited, stack, parent) to begin.`;
                }
            }
        }
    });

    // Helper: consistent edge key for undirected graph
    function edgeKey(u, v) {
        return [String(u), String(v)].sort().join('---');
    }
})();