/**
 * algo-mergeSort.js
 * Zero-Boilerplate Trace Parser for Merge Sort Diamond Tree
 */

(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found.");
        return;
    }

    const { COLORS, decodeHeapValue } = window.Labyrinth;

    window.Labyrinth.registerAlgorithm({
        id: 'mergeSort',
        name: "Merge Sort (Tree View)",
        fields: [
            { id: 'array', label: 'Global Array to Sort (e.g. arr)', type: 'list' }
        ],

        render(ctx, state, globals) {
            const arrVar = state.mappings['array'];
            if (!arrVar) return;

            const trace = window.Labyrinth.State.currentTrace;
            const stepIndex = window.Labyrinth.State.traceIndex;
            if (!trace || stepIndex < 0) return;

            // 1. Get original array from the first step where it exists natively
            let originalArray = [];
            for (let i = 0; i < trace.length; i++) {
                if (trace[i].ordered_globals && trace[i].ordered_globals.includes(arrVar)) {
                    originalArray = decodeHeapValue(trace[i].globals[arrVar], trace[i].heap) || [];
                    if (originalArray.length > 0) break;
                }
            }
            if (!originalArray || originalArray.length === 0) return;

            const N = originalArray.length;
            const maxDepth = Math.ceil(Math.log2(N)) || 1;

            // 2. Pre-Calculate Diamond Tree Geometry Deterministically
            const nodes = {};
            const links = [];

            function nodeKey(row, start, end) { return `${row}_${start}_${end}`; }

            function buildTree(start, end, depth) {
                const key = nodeKey(depth, start, end);
                nodes[key] = {
                    type: 'split', row: depth, start, end, status: 'idle', values: originalArray.slice(start, end + 1)
                };

                if (start < end) {
                    const mid = start + Math.floor((end - start) / 2);
                    links.push({ from: key, to: nodeKey(depth + 1, start, mid) });
                    links.push({ from: key, to: nodeKey(depth + 1, mid + 1, end) });
                    buildTree(start, mid, depth + 1);
                    buildTree(mid + 1, end, depth + 1);
                }

                const mergeRow = (maxDepth * 2) - depth;
                nodes[`merge_${start}_${end}`] = {
                    type: 'merge', row: mergeRow, start, end, status: 'hidden', values: new Array(end - start + 1).fill(null)
                };
            }
            buildTree(0, N - 1, 0);

            // Backfill Merge node links bottom-up
            Object.values(nodes).forEach(n => {
                if (n.type === 'split' && n.start === n.end) {
                    links.push({ from: nodeKey(n.row, n.start, n.end), to: `merge_${n.start}_${n.end}` });
                }
                if (n.type === 'split' && n.start < n.end) {
                    const mid = n.start + Math.floor((n.end - n.start) / 2);
                    links.push({ from: `merge_${n.start}_${mid}`, to: `merge_${n.start}_${n.end}` });
                    links.push({ from: `merge_${mid + 1}_${n.end}`, to: `merge_${n.start}_${n.end}` });
                }
            });

            // Helper to infer split bounds from any two integers in the local scope
            function inferBounds(locals, heap) {
                let ints = [];
                for (const k in locals) {
                    const val = decodeHeapValue(locals[k], heap);
                    if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < N) {
                        ints.push(val);
                    }
                }
                if (ints.length >= 2) {
                    ints.sort((a, b) => a - b);
                    // Return the smallest and largest integers found in the scope as the assumed bounds
                    return { l: ints[0], r: ints[ints.length - 1] };
                }
                return { l: null, r: null };
            }

            // 3. Play historical trace iteratively up to current step 
            //    to track which paths have been explored or mutated
            let activeMerges = {};

            for (let i = 0; i <= stepIndex; i++) {
                const s = trace[i];
                const sStack = s.stack_to_render || [];
                const currArr = decodeHeapValue(s.globals[arrVar], s.heap);

                let currentMergeFrames = {};

                sStack.forEach(frame => {
                    const fn = (frame.func_name || "").toLowerCase();
                    const locals = frame.encoded_locals || {};

                    const bounds = inferBounds(locals, s.heap);
                    const l = bounds.l;
                    const r = bounds.r;

                    // If valid bounds are found, mark as done in history
                    if (l !== null && r !== null) {
                        if (fn.includes('merge') && !fn.includes('sort')) { // Usually the merge action
                            const key = `merge_${l}_${r}`;
                            const mNode = nodes[key];
                            if (mNode) {
                                mNode.status = 'done';
                                activeMerges[key] = true;
                                currentMergeFrames[key] = true;
                                // Mutate contents live
                                if (currArr) mNode.values = currArr.slice(l, r + 1);
                            }
                        } else if (fn.includes('sort') || fn.includes('merge')) { // Could be merge_sort or sort
                            const k = Object.keys(nodes).find(key => nodes[key].type === 'split' && nodes[key].start === l && nodes[key].end === r);
                            if (k) nodes[k].status = 'done';
                        }
                    }
                });

                // When a merge completes and pops off the stack, grab the definitive sorted snapshot
                Object.keys(activeMerges).forEach(key => {
                    if (!currentMergeFrames[key]) {
                        const mNode = nodes[key];
                        if (mNode && currArr) mNode.values = currArr.slice(mNode.start, mNode.end + 1);
                        delete activeMerges[key]; // stop ticking
                    }
                });
            }

            // 4. Override with Active execution frame state for highlighter
            let currentAction = "Merge Sort Timeline Started";
            const currentStack = trace[stepIndex].stack_to_render || [];

            currentStack.forEach(frame => {
                const fn = (frame.func_name || "").toLowerCase();
                const locals = frame.encoded_locals || {};

                const bounds = inferBounds(locals, trace[stepIndex].heap);
                const l = bounds.l;
                const r = bounds.r;

                if (l !== null && r !== null) {
                    if (fn.includes('merge') && !fn.includes('sort')) {
                        const mNode = nodes[`merge_${l}_${r}`];
                        if (mNode) mNode.status = 'active';
                        currentAction = `Merging Arrays [ ${l} : ${r} ]`;
                    } else if (fn.includes('sort') || fn.includes('merge')) {
                        const k = Object.keys(nodes).find(key => nodes[key].type === 'split' && nodes[key].start === l && nodes[key].end === r);
                        if (k) nodes[k].status = 'active';
                        currentAction = `Splitting Subarray [ ${l} : ${r} ]`;
                    }
                }
            });

            // 5. Draw the Dynamic Diamond Tree Canvas
            const W = state.canvas.width || 600;
            const H = state.canvas.height || 400;

            let maxRow = maxDepth * 2;
            const paddingX = 20;
            const paddingY = 30;
            const usableW = W - paddingX * 2;
            const usableH = H - paddingY * 2;

            const spanWidth = usableW / N;
            // Limit block width so large arrays do not overlap out of their spans
            const blockWidth = Math.min((spanWidth * 0.95), 45);
            const rowHeight = maxRow > 0 ? usableH / maxRow : usableH;
            const blockHeight = Math.min(rowHeight * 0.5, 30);

            // Draw Links
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#999';
            links.forEach(l => {
                const fn = nodes[l.from];
                const tn = nodes[l.to];
                if (!fn || !tn || fn.status === 'hidden' || tn.status === 'hidden') return;

                const fx = paddingX + ((fn.start + fn.end) / 2) * spanWidth;
                const fy = paddingY + fn.row * rowHeight + blockHeight;

                const tx = paddingX + ((tn.start + tn.end) / 2) * spanWidth;
                const ty = paddingY + tn.row * rowHeight;

                drawArrow(ctx, fx, fy, tx, ty);
            });

            // Draw Nodes
            ctx.font = 'bold 13px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            Object.values(nodes).forEach(n => {
                if (n.status === 'hidden') return;

                // Center the block array block within its algorithmic domain slice mathematically
                const totalBlockW = (n.end - n.start + 1) * blockWidth;
                const domainCenter = paddingX + ((n.start + n.end) / 2) * spanWidth + (spanWidth / 2);
                const startX = domainCenter - (totalBlockW / 2);
                const startY = paddingY + n.row * rowHeight;

                for (let i = 0; i < (n.end - n.start + 1); i++) {
                    const val = n.values[i];
                    const bx = startX + i * blockWidth;

                    let fill = '#ffffff';
                    let textCol = '#333333';

                    if (n.type === "split") {
                        if (n.status === "active") {
                            fill = '#ff4081'; // pink
                            textCol = '#ffffff';
                        } else if (n.status === "done") {
                            fill = '#e3f2fd'; // light blue
                            textCol = '#0277bd';
                        } else {
                            fill = '#ffffff';
                        }
                    } else {
                        if (n.status === "active") {
                            fill = '#ff9800'; // orange
                            textCol = '#ffffff';
                        } else if (n.status === "done") {
                            fill = '#4caf50'; // green
                            textCol = '#ffffff';
                        }
                    }

                    ctx.fillStyle = fill;
                    ctx.fillRect(bx, startY, blockWidth, blockHeight);

                    ctx.strokeStyle = '#cccccc';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(bx, startY, blockWidth, blockHeight);

                    if (val !== null && val !== undefined) {
                        ctx.fillStyle = textCol;

                        // Protect against printing unparsed objects
                        let finalVal = val;
                        if (typeof val === 'object') {
                            if (Array.isArray(val)) {
                                finalVal = `[..]`;
                            } else if (val.__type__ === 'FUNCTION') {
                                finalVal = 'ƒ()';
                            } else {
                                finalVal = '{}';
                            }
                        }

                        ctx.fillText(String(finalVal), bx + blockWidth / 2, startY + blockHeight / 2);
                    }
                }
            });

            // Update UI description panel
            const desc = document.getElementById('aviz-description');
            if (desc) desc.innerHTML = currentAction;
        }
    });

    function drawArrow(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headlen = 8;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = '#999';
        ctx.fill();
    }

})();
