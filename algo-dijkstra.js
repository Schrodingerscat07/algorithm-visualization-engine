(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-dijkstra.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine } = window.Labyrinth;

    window.Labyrinth.registerAlgorithm({
        id: 'dijkstra',
        name: "Dijkstra's Shortest Path",
        fields: [
            { id: 'edges', label: 'All Edges [(u,v,w),...]', type: 'graph' },
            { id: 'dist', label: 'Distances (Dict)', type: 'any' },
            { id: 'parent', label: 'Parent Tree (Dict)', type: 'any' },
            { id: 'visited', label: 'Visited Nodes (Set)', type: 'any' },
            { id: 'current', label: 'Current Node', type: 'any' },
            { id: 'checking', label: 'Checking Edge (tup)', type: 'any' }
        ],

        render(ctx, state, globals) {
            const edgeVar = state.mappings['edges'];
            if (!edgeVar) return;

            const allEdgesRaw = globals[edgeVar] || [];
            const distState = globals[state.mappings['dist']] || {};
            const parentState = globals[state.mappings['parent']] || {};
            const visitedState = globals[state.mappings['visited']] || [];
            const currentNode = globals[state.mappings['current']];
            const checkingEdge = globals[state.mappings['checking']];

            // Some OPT arrays come back slightly different, so we map them to strings for robust matching
            let visitedSet;
            if (visitedState instanceof Set) {
                visitedSet = new Set(Array.from(visitedState).map(String));
            } else if (Array.isArray(visitedState)) {
                // If the set comes back as an array from the python tutor trace
                visitedSet = new Set(visitedState.map(String));
            } else {
                visitedSet = new Set();
            }

            // Build the SP Tree edges
            const treeEdges = new Set();
            Object.entries(parentState).forEach(([node, p]) => {
                if (p !== null && p !== undefined) {
                    treeEdges.add(edgeKey(node, p));
                }
            });

            const checkingKey = (Array.isArray(checkingEdge) && checkingEdge.length >= 2)
                ? edgeKey(checkingEdge[0], checkingEdge[1])
                : null;

            // 1. Draw All Edges (Base Layer)
            allEdgesRaw.forEach(e => {
                if (!Array.isArray(e) || e.length < 2) return;
                const u = String(e[0]), v = String(e[1]), w = e[2];
                const p1 = state.nodePositions[u], p2 = state.nodePositions[v];
                if (!p1 || !p2) return;

                const key = edgeKey(u, v);

                let color = COLORS.edgeNone;
                let width = 1.5;

                if (key === checkingKey) {
                    color = COLORS.edgeCurr || '#ff9800'; // Orange for edge currently being checked
                    width = 4;
                } else if (treeEdges.has(key)) {
                    color = COLORS.edgeAccept || '#4caf50'; // Green for edges in the shortest path tree
                    width = 3.5;
                }

                drawLine(p1, p2, color, width, String(w));
            });

            // 2. Draw Nodes
            Object.entries(state.nodePositions).forEach(([id, pos]) => {
                let fill = COLORS.nodeFill;
                let stroke = COLORS.nodeStroke;

                if (String(currentNode) === id) {
                    stroke = COLORS.edgeCurr || '#ff9800'; // Make current node stand out
                    fill = '#ffe0b2';
                } else if (visitedSet.has(id)) {
                    stroke = COLORS.edgeAccept || '#4caf50'; // Make finalized nodes green
                    fill = '#c8e6c9';
                }

                drawNode(pos, id, stroke, fill);

                // 3. Draw distance labels above the nodes
                let d = distState[id];
                if (d === undefined) {
                    d = "∞";
                } else if (typeof d === 'number' && d > 99999) {
                    // float("inf") typically comes across as a very large number or specific repr
                    d = "∞";
                }

                ctx.fillStyle = '#d32f2f';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`d=${d}`, pos.x, pos.y - 18);
            });

            // 4. Update Description based on state
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (checkingEdge) {
                    desc.innerHTML = `Relaxing edge <b>(${checkingEdge[0]}, ${checkingEdge[1]})</b> with weight ${checkingEdge[2]}.`;
                } else if (currentNode) {
                    desc.innerHTML = `Processing node <b>${currentNode}</b>. Current distance: ${distState[currentNode]}`;
                } else {
                    desc.innerHTML = `Dijkstra's Algorithm Visualization. Map your variables above to begin.`;
                }
            }
        }
    });

    // Helper: consistent edge key for undirected graph
    function edgeKey(u, v) {
        const arr = [String(u), String(v)].sort();
        return arr.join('---');
    }

})();
