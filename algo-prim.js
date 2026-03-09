/**
 * algo-prim.js
 * Prim's MST Visualization Plugin for Labyrinth.
 */

(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-prim.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine } = window.Labyrinth;

    window.Labyrinth.registerAlgorithm({
        id: 'prim',
        name: "Prim's MST",
        fields: [
            { id: 'edges', label: 'All Edges [(u,v,w),...]', type: 'graph' },
            { id: 'mst', label: 'MST Edges (Current List)', type: 'list' },
            { id: 'visited', label: 'Visited Nodes (Set/List)', type: 'any' },
            { id: 'current', label: 'Edge Being Considered (tup)', type: 'any' }
        ],

        render(ctx, state, globals) {
            const edgeVar = state.mappings['edges'];
            if (!edgeVar) return;

            const allEdgesRaw = globals[edgeVar] || [];
            const mstEdgesRaw = globals[state.mappings['mst']] || [];
            const visitedState = globals[state.mappings['visited']] || [];
            const currentEdge = globals[state.mappings['current']] || null;

            // Convert MST edges to a set of keys for fast lookup
            const mstSet = new Set();
            if (Array.isArray(mstEdgesRaw)) {
                mstEdgesRaw.forEach(e => {
                    if (Array.isArray(e) && e.length >= 2) mstSet.add(edgeKey(e[0], e[1]));
                });
            }
            
            // Convert visited nodes to a string set
            let visitedSet;
            if (visitedState instanceof Set) {
                visitedSet = new Set(Array.from(visitedState).map(String));
            } else if (Array.isArray(visitedState)) {
                visitedSet = new Set(visitedState.map(String));
            } else {
                visitedSet = new Set();
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
                    color = COLORS.edgeCurr || '#ff9800'; // Orange
                    width = 4;
                } else if (mstSet.has(key)) {
                    color = COLORS.edgeAccept || '#4caf50'; // Green
                    width = 3.5;
                }

                drawLine(p1, p2, color, width, String(w));
            });

            // 2. Draw Nodes
            Object.entries(state.nodePositions).forEach(([id, pos]) => {
                let fill = COLORS.nodeFill;
                let stroke = COLORS.nodeStroke;

                if (currentEdge && (String(currentEdge[0]) === id || String(currentEdge[1]) === id)) {
                    stroke = COLORS.edgeCurr || '#ff9800';
                } else if (visitedSet.has(id)) {
                    stroke = COLORS.edgeAccept || '#4caf50';
                    fill = '#c8e6c9';
                }

                drawNode(pos, id, stroke, fill);
            });

            // 3. Update Description based on state
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (currKey) {
                    const u = currentEdge[0], v = currentEdge[1];
                    desc.innerHTML = `Considering minimum edge <b>(${u}, ${v})</b> connecting to the growing MST.`;
                } else if (mstSet.size > 0) {
                    desc.innerHTML = `MST is being built starting from an initial node. Total edges in MST: <b>${mstSet.size}</b>.`;
                } else {
                    desc.innerHTML = `Map your Python variables above to visualize Prim's algorithm in real-time.`;
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
