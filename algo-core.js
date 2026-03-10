/**
 * algo-core.js
 * The backbone of the Labyrinth visualization system.
 * Handles UI, Trace Interception w/ OPT Heap Decoding, Resizer, and Algorithm Registration.
 */

(function () {
    'use strict';

    // ─── Constants & Colors (White Theme) ──────────────────────────────────────
    const COLOR = {
        bg: '#ffffff',
        text: '#333333',
        panelBg: '#f8f9fa',
        border: '#dddddd',
        accent: '#7b8cde',
        canvasBg: '#fcfcfc',
        nodeStroke: '#34495e',
        nodeFill: '#ffffff',
        nodeText: '#34495e',
        edgeNone: '#bdc3c7',
        edgeCurr: '#f39c12',
        edgeAccept: '#2ecc71',
        edgeReject: '#e74c3c',
    };

    // ─── State ────────────────────────────────────────────────────────────────
    const State = {
        algorithms: {},
        selectedAlgo: null,
        mappings: {},
        detectedGlobals: {},   // Decoded Python variables { name: jsValue }
        currentTrace: null,
        traceIndex: -1,
        canvas: null,
        ctx: null,
        nodePositions: {},
    };

    window.Labyrinth = {
        registerAlgorithm(config) {
            State.algorithms[config.id] = config;
            updateAlgoDropdown();
        },
        COLORS: COLOR,
        drawNode,
        drawLine,
        State,
        handleTrace(result) {
            try {
                if (result && result.trace && Array.isArray(result.trace)) {
                    State.currentTrace = result.trace;
                    State.traceIndex = result.trace.length > 0 ? result.trace.length - 1 : 0;
                    extractGlobalsFromCurrentStep();
                } else if (result && Array.isArray(result) && result.length > 0 && result[0].ordered_globals) {
                    State.currentTrace = result;
                    State.traceIndex = result.length - 1;
                    extractGlobalsFromCurrentStep();
                }
            } catch (e) {
                console.error("Error in handleTrace", e);
            }
        },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════
    function init() {
        setupAlgoPanel();
        setupResizer();
        installTraceHook();
        requestAnimationFrame(renderLoop);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. ALGO PANEL UI
    // ═══════════════════════════════════════════════════════════════════════════
    function setupAlgoPanel() {
        const panel = document.getElementById('aviz-algo-panel');
        if (!panel) return;

        panel.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:15px; height:600px; font-family:'Segoe UI',sans-serif; color:#333;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid ${COLOR.border}; padding-bottom:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <label style="font-size:12px; font-weight:700; color:#555; text-transform:uppercase;">Algorithm:</label>
            <select id="aviz-algo-select" style="${selectStyle()}">
              <option value="">-- Select Algorithm --</option>
            </select>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="aviz-refresh-btn" style="background:none; border:1px solid #ccc; border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer; color:#555;" title="Force refresh variables">⟳ Refresh</button>
            <div id="aviz-status" style="font-size:11px; color:#888;">Waiting for code execution...</div>
          </div>
        </div>

        <!-- Body: Mapping + Canvas -->
        <div style="display:flex; gap:15px; flex:1; min-height:0;">
          <!-- Mapping Sidebar -->
          <div id="aviz-mapping-sidebar" style="width:200px; display:flex; flex-direction:column; gap:8px; padding:12px; background:${COLOR.panelBg}; border-radius:8px; border:1px solid ${COLOR.border}; overflow-y:auto;">
            <div style="font-size:11px; font-weight:700; color:#777; text-transform:uppercase; border-bottom:1px solid #eee; padding-bottom:4px;">Mapping</div>
            <div id="aviz-mapping-fields" style="display:flex; flex-direction:column; gap:10px;">
              <div style="font-size:12px; color:#999; font-style:italic; text-align:center; padding:20px 0;">Select an algorithm first</div>
            </div>
            <div id="aviz-detected-vars" style="margin-top:auto; padding-top:8px; border-top:1px solid #eee;">
              <div style="font-size:10px; font-weight:700; color:#999; text-transform:uppercase; margin-bottom:4px;">Detected Variables</div>
              <div id="aviz-var-list" style="font-size:11px; color:#666; line-height:1.6;">None yet</div>
            </div>
          </div>

          <!-- Canvas -->
          <div style="flex:1; position:relative; display:flex; flex-direction:column; gap:10px;">
            <div id="aviz-canvas-wrap" style="position:relative; flex:1; background:${COLOR.canvasBg}; border:1px solid ${COLOR.border}; border-radius:8px; overflow:hidden;">
              <canvas id="aviz-canvas" style="display:block; width:100%; height:100%;"></canvas>
              <div id="aviz-step-overlay" style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.85); padding:5px 12px; border-radius:20px; font-size:11px; font-weight:600; color:#555; border:1px solid #ddd;">No Trace</div>
            </div>
            <div id="aviz-description" style="padding:12px 18px; background:#f0f4f8; border-radius:6px; font-size:13px; line-height:1.5; color:#2c3e50; border-left:4px solid ${COLOR.accent}; min-height:40px;">
              Write Python code with graph data. Map your variables to visualize the algorithm.
            </div>
          </div>
        </div>
      </div>
    `;

        State.canvas = document.getElementById('aviz-canvas');
        State.ctx = State.canvas.getContext('2d');

        // Canvas resize
        const ro = new ResizeObserver(() => {
            if (State.canvas) {
                State.canvas.width = State.canvas.clientWidth;
                State.canvas.height = State.canvas.clientHeight;
                layoutNodes();
            }
        });
        ro.observe(document.getElementById('aviz-canvas-wrap'));

        // Events
        document.getElementById('aviz-algo-select').addEventListener('change', onAlgoChange);
        document.getElementById('aviz-refresh-btn').addEventListener('click', () => {
            forceExtractGlobals();
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. RESIZABLE SPLITTER
    // ═══════════════════════════════════════════════════════════════════════════
    function setupResizer() {
        const resizer = document.getElementById('aviz-resizer');
        const left = document.getElementById('aviz-frames-column');
        if (!resizer || !left) return;

        let isDown = false;
        let startX, startW;

        resizer.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.clientX;
            startW = left.offsetWidth;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const dx = e.clientX - startX;
            const newW = Math.max(280, Math.min(startW + dx, window.innerWidth * 0.7));
            left.style.width = newW + 'px';

            // Ask jsPlumb to repaint arrows if available
            triggerJsPlumbRepaint();
        });

        document.addEventListener('mouseup', () => {
            if (!isDown) return;
            isDown = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            triggerJsPlumbRepaint();
        });
    }

    function triggerJsPlumbRepaint() {
        // PyTutor uses jsPlumb for connector arrows. We need to tell it to repaint.
        try {
            if (window.jsPlumb) {
                window.jsPlumb.repaintEverything();
            }
            if (window.myVisualizer && window.myVisualizer.jsPlumbInstance) {
                window.myVisualizer.jsPlumbInstance.repaintEverything();
            }
            // Also try the jQuery-based jsPlumb
            if (typeof $ !== 'undefined' && $.fn && $.fn.jsPlumb) {
                // noop fallback
            }
        } catch (e) { }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. ALGO DROPDOWN & MAPPING
    // ═══════════════════════════════════════════════════════════════════════════
    function updateAlgoDropdown() {
        const select = document.getElementById('aviz-algo-select');
        if (!select) return;
        const cur = select.value;
        select.innerHTML = '<option value="">-- Select Algorithm --</option>';
        Object.values(State.algorithms).forEach(algo => {
            const opt = document.createElement('option');
            opt.value = algo.id;
            opt.textContent = algo.name;
            select.appendChild(opt);
        });
        select.value = cur;
    }

    function onAlgoChange(e) {
        State.selectedAlgo = e.target.value;
        State.mappings = {};
        const fields = document.getElementById('aviz-mapping-fields');
        if (!State.selectedAlgo) {
            fields.innerHTML = '<div style="font-size:12px; color:#999; font-style:italic; text-align:center; padding:20px 0;">Select an algorithm first</div>';
            return;
        }
        const algo = State.algorithms[State.selectedAlgo];
        fields.innerHTML = '';
        algo.fields.forEach(field => {
            const g = document.createElement('div');
            g.style.cssText = 'display:flex; flex-direction:column; gap:3px;';
            g.innerHTML = `
        <label style="font-size:11px; font-weight:600; color:#555;">${field.label}</label>
        <select class="aviz-mapping-select" data-field-id="${field.id}" style="${selectStyle()}">
          <option value="">-- none --</option>
        </select>
      `;
            fields.appendChild(g);
        });
        refreshMappingDropdowns();
    }

    function refreshMappingDropdowns() {
        const selects = document.querySelectorAll('.aviz-mapping-select');
        const names = Object.keys(State.detectedGlobals).filter(n => !n.startsWith('__')).sort();

        selects.forEach(sel => {
            const fid = sel.dataset.fieldId;
            const prev = State.mappings[fid] || '';
            sel.innerHTML = '<option value="">-- none --</option>';
            names.forEach(n => {
                const o = document.createElement('option');
                o.value = n;
                o.textContent = n;
                sel.appendChild(o);
            });
            // Restore previous selection if still valid
            if (names.includes(prev)) sel.value = prev;
            else sel.value = '';

            sel.onchange = (ev) => {
                State.mappings[fid] = ev.target.value;
                if (fid === 'edges') layoutNodes();
            };
        });

        // Update detected vars display
        const varList = document.getElementById('aviz-var-list');
        if (varList) {
            if (names.length === 0) {
                varList.textContent = 'None yet';
            } else {
                varList.innerHTML = names.map(n => {
                    const v = State.detectedGlobals[n];
                    const preview = JSON.stringify(v);
                    const short = preview.length > 30 ? preview.slice(0, 30) + '…' : preview;
                    return `<div style="display:flex; justify-content:space-between;"><span style="font-weight:600;">${n}</span><span style="color:#aaa;font-size:10px;">${short}</span></div>`;
                }).join('');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. TRACE INTERCEPTION & OPT HEAP DECODER
    // ═══════════════════════════════════════════════════════════════════════════
    function installTraceHook() {
        // Trace is handled by window.Labyrinth.handleTrace mapped in opt-live.bundle.js
        // We poll the #curInstr text to keep Labyrinth synced with timeline scrubbing without needing jQuery
        setInterval(() => {
            let currentStep = undefined;
            const curInstrDiv = document.getElementById('curInstr');
            if (curInstrDiv) {
                const text = curInstrDiv.textContent || "";
                const match = text.match(/Step (\d+)/);
                if (match) {
                    currentStep = parseInt(match[1], 10) - 1; // 0-indexed
                }
            }

            if (currentStep !== undefined && currentStep !== State.traceIndex && State.currentTrace) {
                // Ignore if it's out of bounds of the current trace
                if (currentStep >= 0 && currentStep < State.currentTrace.length) {
                    State.traceIndex = currentStep;
                    extractGlobalsFromCurrentStep();
                }
            }
        }, 100);
    }

    /**
     * Decode OPT trace format at the current step.
     * OPT stores globals as references like ["REF", 1] pointing into a heap.
     * The heap maps IDs to structures like ["LIST", val1, val2, ...]
     * or ["TUPLE", val1, val2, ...] etc.
     */
    function extractGlobalsFromCurrentStep() {
        if (!State.currentTrace || State.traceIndex < 0) return;

        // Find the last "return" or "step_line" event at or before traceIndex
        let step = null;
        for (let i = Math.min(State.traceIndex, State.currentTrace.length - 1); i >= 0; i--) {
            const s = State.currentTrace[i];
            if (s && s.ordered_globals && s.globals) {
                step = s;
                break;
            }
        }
        if (!step) return;

        const heap = step.heap || {};
        const decoded = {};

        for (const varName of (step.ordered_globals || [])) {
            const raw = step.globals[varName];
            decoded[varName] = decodeHeapValue(raw, heap);
        }

        State.detectedGlobals = decoded;
        refreshMappingDropdowns();
        autoDetectGraph();

        const statusEl = document.getElementById('aviz-status');
        if (statusEl) statusEl.textContent = `Step ${State.traceIndex + 1} — ${Object.keys(decoded).length} vars`;
    }

    function decodeHeapValue(val, heap) {
        if (val === null || val === undefined) return val;
        if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') return val;

        // OPT reference: ["REF", heapId]
        if (Array.isArray(val) && val[0] === 'REF') {
            const id = val[1];
            const obj = heap[id];
            if (!obj) return val;
            return decodeHeapObject(obj, heap);
        }

        // Could also be a C_DATA or other special
        if (Array.isArray(val) && val[0] === 'C_DATA') {
            return val[2]; // Just return the raw value
        }

        return val;
    }

    function decodeHeapObject(obj, heap) {
        if (!Array.isArray(obj) || obj.length === 0) return obj;
        const tag = obj[0];

        if (tag === 'LIST' || tag === 'TUPLE' || tag === 'SET') {
            const arr = [];
            for (let i = 1; i < obj.length; i++) {
                arr.push(decodeHeapValue(obj[i], heap));
            }
            return arr;
        }

        if (tag === 'DICT') {
            const dict = {};
            for (let i = 1; i < obj.length; i++) {
                const pair = obj[i];
                if (Array.isArray(pair) && pair.length === 2) {
                    dict[decodeHeapValue(pair[0], heap)] = decodeHeapValue(pair[1], heap);
                }
            }
            return dict;
        }

        if (tag === 'INSTANCE' || tag === 'CLASS') {
            return { __type__: tag, __name__: obj[1] };
        }

        // Fallback
        return obj;
    }

    async function pollPyodide() {
        if (!window.pyodide) return;
        try {
            const raw = window.pyodide.runPython(`
import json as _json
_out = {}
for _k, _v in globals().items():
    if _k.startswith('_') or _k in ('json','sys','math','random','io','pyodide','builtins'): continue
    try:
        _json.dumps(_v)
        _out[_k] = _v
    except:
        try:
            if hasattr(_v, '__iter__'): _out[_k] = list(_v)
            else: _out[_k] = str(_v)
        except: pass
_json.dumps(_out)
      `);
            const globals = JSON.parse(raw);
            let changed = false;
            for (const [k, v] of Object.entries(globals)) {
                if (JSON.stringify(State.detectedGlobals[k]) !== JSON.stringify(v)) {
                    State.detectedGlobals[k] = v;
                    changed = true;
                }
            }
            if (changed) {
                refreshMappingDropdowns();
                autoDetectGraph();
            }
        } catch (e) { }
    }

    function forceExtractGlobals() {
        // Try trace extraction first
        extractGlobalsFromCurrentStep();
        // Then try pyodide
        pollPyodide();
    }

    function autoDetectGraph() {
        for (const [name, val] of Object.entries(State.detectedGlobals)) {
            if (name.startsWith('__')) continue;
            if (!Array.isArray(val) || val.length === 0) continue;
            const first = val[0];
            if (Array.isArray(first) && (first.length === 2 || first.length === 3)) {
                // Looks like an edge list
                if (!State.mappings['edges']) {
                    State.mappings['edges'] = name;
                    layoutNodes();
                    // Update mapping dropdowns to show the selection
                    refreshMappingDropdowns();
                    const selects = document.querySelectorAll('.aviz-mapping-select');
                    selects.forEach(s => {
                        if (s.dataset.fieldId === 'edges') s.value = name;
                    });
                }
                return;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. RENDERING & LAYOUT
    // ═══════════════════════════════════════════════════════════════════════════
    function layoutNodes() {
        if (!State.canvas) return;
        const edgesVar = State.mappings['edges'];
        if (!edgesVar) return;

        // If the selected algorithm provides a custom layout, use it
        const algo = State.algorithms[State.selectedAlgo];
        if (algo && typeof algo.layout === 'function') {
            algo.layout(State, State.detectedGlobals);
            return;
        }

        const rawEdges = State.detectedGlobals[edgesVar];
        if (!Array.isArray(rawEdges) || rawEdges.length === 0) return;

        const validEdges = rawEdges.filter(e => Array.isArray(e) && e.length >= 2);
        const nodes = [...new Set(validEdges.flatMap(e => [String(e[0]), String(e[1])]))];
        if (nodes.length === 0) return;

        const W = State.canvas.width || 600;
        const H = State.canvas.height || 400;
        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.35;

        State.nodePositions = {};
        nodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i / nodes.length) - Math.PI / 2;
            State.nodePositions[n] = {
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle),
            };
        });
    }

    function renderLoop() {
        if (State.ctx && State.canvas) draw();
        requestAnimationFrame(renderLoop);
    }

    function draw() {
        const { ctx, canvas } = State;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = COLOR.canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const algo = State.algorithms[State.selectedAlgo];
        if (!algo) {
            drawGenericGraph();
            return;
        }

        algo.render(ctx, State, State.detectedGlobals);
    }

    function drawGenericGraph() {
        const edgesVar = State.mappings['edges'];
        if (!edgesVar) {
            // Draw placeholder text
            const { ctx, canvas } = State;
            ctx.fillStyle = '#ccc';
            ctx.font = '14px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No graph detected yet. Write code then map variables.', canvas.width / 2, canvas.height / 2);
            return;
        }
        const edges = State.detectedGlobals[edgesVar];
        if (!Array.isArray(edges)) return;

        edges.forEach(e => {
            if (!Array.isArray(e) || e.length < 2) return;
            const u = String(e[0]), v = String(e[1]), w = e.length >= 3 ? e[2] : '';
            const p1 = State.nodePositions[u], p2 = State.nodePositions[v];
            if (p1 && p2) drawLine(p1, p2, COLOR.edgeNone, 1.5, String(w));
        });

        Object.entries(State.nodePositions).forEach(([id, pos]) => {
            drawNode(pos, id, COLOR.nodeStroke, COLOR.nodeFill);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. DRAWING HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    function drawNode(pos, label, stroke, fill) {
        const { ctx } = State;
        const r = 20;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = fill;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = COLOR.nodeText;
        ctx.font = 'bold 13px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pos.x, pos.y);
    }

    function drawLine(p1, p2, color, width, label) {
        const { ctx } = State;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();

        if (label && label !== 'undefined') {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const tw = ctx.measureText(label).width + 8;
            ctx.fillStyle = '#fff';
            ctx.fillRect(mx - tw / 2, my - 9, tw, 18);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(mx - tw / 2, my - 9, tw, 18);
            ctx.fillStyle = '#555';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, mx, my);
        }
    }

    function selectStyle() {
        return `background:#fff; color:#333; border:1px solid #ccc; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer; outline:none;`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOOT
    // ═══════════════════════════════════════════════════════════════════════════
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
