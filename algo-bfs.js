(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-bfs.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine } = window.Labyrinth;

    window.Labyrinth.registerAlgorithm({
        id: 'bfs',
        name: "Breadth First Search",
        fields: [
            { id: 'edges', label: 'All Edges [(u,v),...]', type: 'graph' },
            { id: 'visited', label: 'Visited (Set)', type: 'any' },
            { id: 'queue', label: 'Queue (List)', type: 'any' },
            { id: 'parent', label: 'Parent Tree (Dict)', type: 'any' },
            { id: 'current', label: 'Current Node', type: 'any' }
        ],

        render(ctx, state, globals) {
            const edgeVar = state.mappings['edges'];
            if (!edgeVar) return;

            const allEdgesRaw = globals[edgeVar] || [];
            const visitedState = globals[state.mappings['visited']] || [];
            const queueState = globals[state.mappings['queue']] || [];
            const parentState = globals[state.mappings['parent']] || {};
            const currentNode = String(globals[state.mappings['current']]);

            // Convert to Sets for robust lookups
            const visitedSet = new Set(Array.from(visitedState).map(String));
            const queueSet = new Set(Array.from(queueState).map(String));

            // Build the BFS Tree (edges leading to visited nodes)
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
                    color = '#2196f3'; // Blue for BFS Tree edges
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
                    stroke = '#ff9800'; // Orange for the node being dequeued
                    fill = '#ffe0b2';
                    label = "Processing";
                } else if (queueSet.has(id)) {
                    stroke = '#2196f3'; // Blue for nodes waiting in the queue
                    fill = '#bbdefb';
                    label = "In Queue";
                } else if (visitedSet.has(id)) {
                    stroke = COLORS.edgeAccept || '#4caf50'; // Green for finished nodes
                    fill = '#c8e6c9';
                    label = "Visited";
                }

                drawNode(pos, id, stroke, fill);

                // Draw distance/level label if you have a 'dist' mapping, 
                // otherwise just show the status label
                if (label) {
                    ctx.fillStyle = stroke;
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(label, pos.x, pos.y - 18);
                }
            });

            // 3. Update Description
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (currentNode && currentNode !== "undefined") {
                    desc.innerHTML = `BFS: Dequeued node <b>${currentNode}</b>. Exploring its neighbors.`;
                } else {
                    desc.innerHTML = `BFS Visualization. Map your <b>queue</b> and <b>visited</b> variables to see the frontier.`;
                }
            }
        }
    });

    function edgeKey(u, v) {
        return [String(u), String(v)].sort().join('---');
    }
})();
