/**
 * algo-multigraph.js
 * Multi-Weighted Graph Visualization Plugin for Labyrinth.
 *
 * Supports THREE edge formats:
 *   1. Class instances with adjacency list:  g = MultiGraph(); g.add_edge("A","B",4)
 *      → decoded as {__type__:'INSTANCE', graph: {A: [["B",4],...], B: [["A",4],...], ...}}
 *   2. Dictionary-based flat list:  edges = [{from:"A", to:"B", weight:4}, ...]
 *   3. Tuple-based flat list:  edges = [(u, v, w), ...]
 *
 * Also supports multiple edges between the same pair of nodes (drawn as Bezier curves).
 */

(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-multigraph.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, drawNode, drawLine, State: coreState } = window.Labyrinth;

    // ─── Register the algorithm ─────────────────────────────────────────────────
    window.Labyrinth.registerAlgorithm({
        id: 'multigraph',
        name: "Multi-Weighted Graph",
        fields: [
            { id: 'edges', label: 'Graph Object / Edge List', type: 'graph' },
            { id: 'highlight', label: 'Highlighted Edge (Dict)', type: 'any' }
        ],

        // ─── Main render (called every animation frame) ─────────────────────────
        render(ctx, state, globals) {

            // ── Step 1: Find edges ──────────────────────────────────────────────
            // Try to resolve edges from multiple sources:
            //   a) User-mapped variable
            //   b) Auto-detect class instance with .graph adjacency list
            //   c) Auto-detect flat edge list (dicts or tuples)
            var edgeData = resolveEdges(state, globals);

            if (!edgeData || edgeData.length === 0) {
                // Nothing to draw — show placeholder
                ctx.fillStyle = '#ccc';
                ctx.font = '14px Segoe UI, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    'No graph detected. Run code with a MultiGraph class or an edge list.',
                    state.canvas.width / 2,
                    state.canvas.height / 2
                );
                return;
            }

            // edgeData is now a flat array of {from, to, weight} objects

            // ── Step 2: Find highlighted edge ───────────────────────────────────
            var highlightEdge = findHighlightEdge(state, globals);

            var highlightKey = null;
            if (highlightEdge && highlightEdge.from !== undefined && highlightEdge.to !== undefined) {
                highlightKey = edgeKey(String(highlightEdge.from), String(highlightEdge.to), highlightEdge.weight);
            }

            // ── Step 3: Draw all edges ──────────────────────────────────────────
            for (var i = 0; i < edgeData.length; i++) {
                var e = edgeData[i];
                var u = String(e.from);
                var v = String(e.to);
                var w = e.weight !== undefined ? e.weight : '';

                var p1 = state.nodePositions[u];
                var p2 = state.nodePositions[v];
                if (!p1 || !p2) continue;

                var key = edgeKey(u, v, w);
                var color = COLORS.edgeNone;
                var lineWidth = 1.5;

                if (key === highlightKey) {
                    color = COLORS.edgeCurr;
                    lineWidth = 4;
                }

                drawLine(p1, p2, color, lineWidth, String(w), key);
            }

            // ── Step 4: Draw all nodes ──────────────────────────────────────────
            var nodeEntries = Object.entries(state.nodePositions);
            for (var n = 0; n < nodeEntries.length; n++) {
                var id = nodeEntries[n][0];
                var pos = nodeEntries[n][1];

                var fill = COLORS.nodeFill;
                var stroke = COLORS.nodeStroke;

                if (highlightEdge && (String(highlightEdge.from) === id || String(highlightEdge.to) === id)) {
                    stroke = COLORS.edgeCurr;
                }

                drawNode(pos, id, stroke, fill);
            }

            // ── Step 5: Update description ──────────────────────────────────────
            var desc = document.getElementById('aviz-description');
            if (desc) {
                if (highlightKey && highlightEdge) {
                    desc.innerHTML =
                        'Highlighting edge <b>(' + highlightEdge.from + ' → ' + highlightEdge.to + ')</b>' +
                        ' weight <b>' + (highlightEdge.weight !== undefined ? highlightEdge.weight : '?') + '</b>';
                } else {
                    desc.innerHTML =
                        'Multi-Weighted Graph — <b>' + edgeData.length + '</b> edges, <b>' +
                        Object.keys(state.nodePositions).length + '</b> nodes. ' +
                        'Step through the trace to see edge highlights.';
                }
            }

            // ── Step 6: Update step overlay ─────────────────────────────────────
            var overlay = document.getElementById('aviz-step-overlay');
            if (overlay && coreState.currentTrace) {
                overlay.textContent = 'Step ' + (coreState.traceIndex + 1) + ' / ' + coreState.currentTrace.length;
            }
        }
    });


    // ═════════════════════════════════════════════════════════════════════════════
    // resolveEdges: Find and normalize edges from globals
    // Returns flat array of {from, to, weight} or null
    // ═════════════════════════════════════════════════════════════════════════════
    function resolveEdges(state, globals) {

        var mappedVar = state.mappings['edges'];

        // If user has explicitly mapped a variable, try to use it
        if (mappedVar && globals[mappedVar] !== undefined) {
            var val = globals[mappedVar];
            var result = normalizeToEdgeList(val);
            if (result && result.length > 0) return result;
        }

        // Auto-detect: scan all globals for something that looks like a graph
        for (var key in globals) {
            if (key.startsWith('__')) continue;
            var value = globals[key];
            if (value === null || value === undefined) continue;

            var edges = normalizeToEdgeList(value);
            if (edges && edges.length > 0) {
                // Auto-map this variable
                state.mappings['edges'] = key;

                // Trigger layout if node positions are empty
                if (Object.keys(state.nodePositions).length === 0) {
                    if (window.Labyrinth.layoutNodes) {
                        window.Labyrinth.layoutNodes();
                    }
                }

                // Update the UI dropdown
                if (window.Labyrinth.refreshMappingDropdowns) {
                    window.Labyrinth.refreshMappingDropdowns();
                }
                var selects = document.querySelectorAll('.aviz-mapping-select');
                for (var s = 0; s < selects.length; s++) {
                    if (selects[s].dataset.fieldId === 'edges') {
                        selects[s].value = key;
                    }
                }

                return edges;
            }
        }

        return null;
    }


    // ═════════════════════════════════════════════════════════════════════════════
    // normalizeToEdgeList: Convert various graph formats to [{from, to, weight}]
    // ═════════════════════════════════════════════════════════════════════════════
    function normalizeToEdgeList(value) {

        // ── Format 1: Class instance with .graph adjacency list ─────────────
        // e.g. {__type__: 'INSTANCE', __name__: 'MultiGraph', graph: {A: [["B",4],["C",2]], ...}}
        if (value && typeof value === 'object' && !Array.isArray(value) && value.__type__ === 'INSTANCE') {
            var adjList = value.graph;
            if (adjList && typeof adjList === 'object' && !Array.isArray(adjList)) {
                return adjacencyListToEdges(adjList);
            }
        }

        // ── Format 2: Plain adjacency list dict (no class wrapper) ──────────
        // e.g. graph = {"A": [["B",4],["C",2]], "B": [["A",4]], ...}
        if (value && typeof value === 'object' && !Array.isArray(value) && !value.__type__) {
            // Check if it looks like an adjacency list: all values are arrays of arrays/tuples
            var keys = Object.keys(value);
            if (keys.length >= 2) {
                var looksLikeAdjList = true;
                for (var k = 0; k < keys.length; k++) {
                    var neighbors = value[keys[k]];
                    if (!Array.isArray(neighbors)) { looksLikeAdjList = false; break; }
                    if (neighbors.length > 0) {
                        var first = neighbors[0];
                        // Each neighbor entry should be [node, weight] or [node]
                        if (!Array.isArray(first) || first.length < 1) {
                            looksLikeAdjList = false;
                            break;
                        }
                    }
                }
                if (looksLikeAdjList) {
                    return adjacencyListToEdges(value);
                }
            }
        }

        // ── Format 3: Flat list of dicts [{from, to, weight}, ...] ──────────
        if (Array.isArray(value) && value.length > 0) {
            var first = value[0];
            if (first && typeof first === 'object' && !Array.isArray(first) && 'from' in first && 'to' in first) {
                var edges = [];
                for (var i = 0; i < value.length; i++) {
                    var e = value[i];
                    if (e && 'from' in e && 'to' in e) {
                        edges.push({ from: String(e.from), to: String(e.to), weight: e.weight });
                    }
                }
                return edges;
            }

            // ── Format 4: Flat list of tuples [(u, v, w), ...] ──────────────
            if (Array.isArray(first) && (first.length === 2 || first.length === 3)) {
                var edges = [];
                for (var i = 0; i < value.length; i++) {
                    var t = value[i];
                    if (Array.isArray(t) && t.length >= 2) {
                        edges.push({
                            from: String(t[0]),
                            to: String(t[1]),
                            weight: t.length >= 3 ? t[2] : undefined
                        });
                    }
                }
                return edges;
            }
        }

        return null;
    }


    // ═════════════════════════════════════════════════════════════════════════════
    // adjacencyListToEdges: Convert {A: [[B,4],[C,2]], B: [[A,4],...]} to flat list
    // Deduplicates undirected edges (A→B and B→A become one edge)
    // ═════════════════════════════════════════════════════════════════════════════
    function adjacencyListToEdges(adjList) {
        var edges = [];
        var seen = {};  // track "A---B---4" to avoid duplicating undirected edges

        for (var node in adjList) {
            var neighbors = adjList[node];
            if (!Array.isArray(neighbors)) continue;

            for (var i = 0; i < neighbors.length; i++) {
                var entry = neighbors[i];
                var neighbor, weight;

                if (Array.isArray(entry) && entry.length >= 1) {
                    // Tuple format: [neighbor, weight] or [neighbor]
                    neighbor = String(entry[0]);
                    weight = entry.length >= 2 ? entry[1] : undefined;
                } else if (typeof entry === 'string' || typeof entry === 'number') {
                    // Simple neighbor without weight
                    neighbor = String(entry);
                    weight = undefined;
                } else {
                    continue;
                }

                // Build a unique key to deduplicate undirected edges
                var sortedPair = [String(node), neighbor].sort();
                var dedupKey = sortedPair[0] + '---' + sortedPair[1] + '---' + (weight !== undefined ? weight : '');

                if (!seen[dedupKey]) {
                    seen[dedupKey] = true;
                    edges.push({
                        from: String(node),
                        to: neighbor,
                        weight: weight
                    });
                }
            }
        }

        return edges;
    }


    // ═════════════════════════════════════════════════════════════════════════════
    // findHighlightEdge: Find highlighted edge from multiple sources
    // ═════════════════════════════════════════════════════════════════════════════
    function findHighlightEdge(state, globals) {

        // Source 1: User-mapped 'highlight' variable
        var mapped = globals[state.mappings['highlight']];
        if (mapped && typeof mapped === 'object' && 'from' in mapped && 'to' in mapped) {
            return mapped;
        }

        // Source 2: Global 'current_step' dict
        var step = globals['current_step'];
        if (step && typeof step === 'object' && 'from' in step && 'to' in step) {
            return step;
        }

        // Source 3: Global 'highlight' variable
        var hl = globals['highlight'];
        if (hl && typeof hl === 'object' && 'from' in hl && 'to' in hl) {
            return hl;
        }

        // Source 4: Scan OPT trace stack frames for edge-like local variables
        if (coreState.currentTrace && coreState.traceIndex >= 0) {
            var traceStep = coreState.currentTrace[coreState.traceIndex];
            if (!traceStep) return null;

            var heap = traceStep.heap || {};
            var decode = window.Labyrinth.decodeHeapValue;

            // Check stack frames for local variables
            if (traceStep.stack_to_render && traceStep.stack_to_render.length > 0) {
                var deepestFrame = traceStep.stack_to_render[traceStep.stack_to_render.length - 1];
                if (deepestFrame && deepestFrame.encoded_locals) {
                    var localNames = deepestFrame.ordered_varnames || Object.keys(deepestFrame.encoded_locals);
                    for (var i = 0; i < localNames.length; i++) {
                        var localName = localNames[i];
                        var rawVal = deepestFrame.encoded_locals[localName];
                        if (!rawVal) continue;

                        var decoded = decode ? decode(rawVal, heap) : rawVal;
                        if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)
                            && 'from' in decoded && 'to' in decoded) {
                            return decoded;
                        }
                    }
                }
            }

            // Check globals in trace for edge-like dicts
            if (traceStep.ordered_globals && traceStep.globals) {
                for (var g = 0; g < traceStep.ordered_globals.length; g++) {
                    var gName = traceStep.ordered_globals[g];
                    if (gName === 'edges' || gName === 'g' || gName.startsWith('__')) continue;

                    var gRaw = traceStep.globals[gName];
                    var gDecoded = decode ? decode(gRaw, heap) : gRaw;
                    if (gDecoded && typeof gDecoded === 'object' && !Array.isArray(gDecoded)
                        && 'from' in gDecoded && 'to' in gDecoded) {
                        return gDecoded;
                    }
                }
            }
        }

        return null;
    }


    // ═════════════════════════════════════════════════════════════════════════════
    // edgeKey: Consistent key for undirected edge comparison
    // ═════════════════════════════════════════════════════════════════════════════
    function edgeKey(u, v, w) {
        var sorted = [String(u), String(v)].sort();
        return sorted[0] + '---' + sorted[1] + (w !== undefined && w !== '' ? '---' + w : '');
    }

})();
