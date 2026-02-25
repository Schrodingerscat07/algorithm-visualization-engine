/**
 * algo-kruskal.js
 * Kruskal's MST Visualization Plugin for AlgoVista.
 */

(function () {
    'use strict';

    if (!window.AlgoVista) {
        console.error("AlgoVista core not found. algo-kruskal.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine } = window.AlgoVista;

    window.AlgoVista.registerAlgorithm({
        id: 'kruskal',
        name: "Kruskal's MST",
        fields: [
            { id: 'edges', label: 'All Edges [(u,v,w),...]', type: 'graph' },
            { id: 'mst', label: 'MST Edges (Current List)', type: 'list' },
            { id: 'parent', label: 'Union-Find Parents (Dict/List)', type: 'any' },
            { id: 'current', label: 'Edge Being Considered (tup)', type: 'any' }
        ],

        render(ctx, state, globals) {
            const edgeVar = state.mappings['edges'];
            if (!edgeVar) return;

            const allEdgesRaw = globals[edgeVar] || [];
            const mstEdgesRaw = globals[state.mappings['mst']] || [];
            const parentState = globals[state.mappings['parent']] || null;
            const currentEdge = globals[state.mappings['current']] || null;

            // Convert MST edges to a set of keys for fast lookup
            const mstSet = new Set();
            if (Array.isArray(mstEdgesRaw)) {
                mstEdgesRaw.forEach(e => {
                    if (Array.isArray(e) && e.length >= 2) mstSet.add(edgeKey(e[0], e[1]));
                });
            }

            // Current edge key
            const currKey = (Array.isArray(currentEdge) && currentEdge.length >= 2)
                ? edgeKey(currentEdge[0], currentEdge[1])
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

                if (key === currKey) {
                    color = COLORS.edgeCurr;
                    width = 4;
                } else if (mstSet.has(key)) {
                    color = COLORS.edgeAccept;
                    width = 3.5;
                }

                drawLine(p1, p2, color, width, String(w));
            });

            // 2. Draw Nodes
            Object.entries(state.nodePositions).forEach(([id, pos]) => {
                let fill = COLORS.nodeFill;
                let stroke = COLORS.nodeStroke;

                // If part of MST, maybe different fill? 
                // For now, let's keep it simple and clean.
                if (currentEdge && (String(currentEdge[0]) === id || String(currentEdge[1]) === id)) {
                    stroke = COLORS.edgeCurr;
                }

                drawNode(pos, id, stroke, fill);
            });

            // 3. Update Description based on state
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (currKey) {
                    const u = currentEdge[0], v = currentEdge[1];
                    desc.innerHTML = `Considering edge <b>(${u}, ${v})</b>. Checking if it creates a cycle using Union-Find.`;
                } else if (mstSet.size > 0) {
                    desc.innerHTML = `MST is being built. Total edges in MST: <b>${mstSet.size}</b>.`;
                } else {
                    desc.innerHTML = `Map your Python variables above to visualize Kruskal's algorithm in real-time.`;
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
