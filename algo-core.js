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
        layoutNodes: null,           // will be bound after definition
        refreshMappingDropdowns: null, // will be bound after definition
        decodeHeapValue: null,       // will be bound shortly
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
        updateAlgoDropdown();
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
      <div style="display:flex; flex-direction:column; gap:10px; height:600px; font-family:'Segoe UI',sans-serif; color:#333;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid ${COLOR.border}; padding-bottom:8px;">
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

        <!-- Mapping Section (compact horizontal strip) -->
        <div id="aviz-mapping-sidebar" style="display:flex; flex-wrap:wrap; gap:8px; padding:8px 10px; background:${COLOR.panelBg}; border-radius:6px; border:1px solid ${COLOR.border}; align-items:center;">
          <div style="font-size:10px; font-weight:700; color:#777; text-transform:uppercase; margin-right:4px;">Map:</div>
          <div id="aviz-mapping-fields" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
            <div style="font-size:11px; color:#999; font-style:italic;">Select an algorithm first</div>
          </div>
          <div id="aviz-detected-vars" style="margin-left:auto; display:flex; align-items:center; gap:4px;">
            <div style="font-size:10px; font-weight:700; color:#999; text-transform:uppercase;">Vars:</div>
            <div id="aviz-var-list" style="font-size:10px; color:#666;">None yet</div>
          </div>
        </div>

        <!-- Canvas (full width, takes remaining height) -->
        <div style="flex:1; position:relative; display:flex; flex-direction:column; gap:8px; min-height:0;">
          <div id="aviz-canvas-wrap" style="position:relative; flex:1; background:${COLOR.canvasBg}; border:1px solid ${COLOR.border}; border-radius:8px; overflow:hidden;">
            <canvas id="aviz-canvas" style="display:block; width:100%; height:100%;"></canvas>
            <div id="aviz-step-overlay" style="position:absolute; top:8px; right:8px; background:rgba(255,255,255,0.85); padding:4px 10px; border-radius:16px; font-size:10px; font-weight:600; color:#555; border:1px solid #ddd;">No Trace</div>
          </div>
          <div id="aviz-description" style="padding:8px 14px; background:#f0f4f8; border-radius:5px; font-size:12px; line-height:1.4; color:#2c3e50; border-left:3px solid ${COLOR.accent}; min-height:30px;">
            Write Python code with graph data. Map your variables to visualize the algorithm.
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

    const TEMPLATES = {
        'mergeSort': `# Labyrinth Zero-Trace Merge Sort
# Just write standard textbook Python; the JS engine builds the tree automatically!

def merge_sort(arr, start, end):
    if start < end:
        mid = start + (end - start) // 2
        merge_sort(arr, start, mid)
        merge_sort(arr, mid + 1, end)
        merge(arr, start, mid, end)

def merge(arr, start, mid, end):
    n1 = mid - start + 1
    n2 = end - mid
    L = [0] * n1
    R = [0] * n2

    for i in range(0, n1):
        L[i] = arr[start + i]
    for j in range(0, n2):
        R[j] = arr[mid + 1 + j]

    i = 0
    j = 0
    k = start
    
    while i < n1 and j < n2:
        if L[i] <= R[j]:
            arr[k] = L[i]
            i += 1
        else:
            arr[k] = R[j]
            j += 1
        k += 1

    while i < n1:
        arr[k] = L[i]
        i += 1
        k += 1

    while j < n2:
        arr[k] = R[j]
        j += 1
        k += 1

# Define your array
my_array = [38, 27, 43, 3, 9, 82, 10]
print("Original:", my_array)

# Start sorting (must use start/end index variables)
merge_sort(my_array, 0, len(my_array) - 1)

print("Sorted:", my_array)
`,
        'multigraph': `class MultiGraph:

    def __init__(self):
        self.graph = {}

    def add_vertex(self, v):
        if v not in self.graph:
            self.graph[v] = []

    def add_edge(self, u, v, weight):
        self.add_vertex(u)
        self.add_vertex(v)
        self.graph[u].append((v, weight))
        self.graph[v].append((u, weight))

    def neighbors(self, v):
        return self.graph.get(v, [])

    def display(self):
        for node in self.graph:
            print(node, "->", self.graph[node])


# Example usage
g = MultiGraph()

g.add_edge("A", "B", 4)
g.add_edge("A", "B", 7)
g.add_edge("A", "C", 2)
g.add_edge("B", "D", 5)

g.display()`
    };

    function onAlgoChange(e) {
        State.selectedAlgo = e.target.value;
        State.mappings = {};
        const fields = document.getElementById('aviz-mapping-fields');
        if (!State.selectedAlgo) {
            fields.innerHTML = '<div style="font-size:11px; color:#999; font-style:italic;">Select an algorithm first</div>';
            return;
        }

        // Auto-inject template code directly into the Ace Editor instance
        if (TEMPLATES[State.selectedAlgo]) {
            try {
                if (window.ace) {
                    window.ace.edit('codeInputPane').setValue(TEMPLATES[State.selectedAlgo], -1);
                } else {
                    console.warn("Ace editor global not found.");
                }
            } catch (e) {
                console.warn("Error injecting template:", e);
            }
        }

        const algo = State.algorithms[State.selectedAlgo];
        fields.innerHTML = '';
        algo.fields.forEach(field => {
            const g = document.createElement('div');
            g.style.cssText = 'display:flex; align-items:center; gap:4px;';
            g.innerHTML = `
        <label style="font-size:10px; font-weight:600; color:#555; white-space:nowrap;">${field.label}:</label>
        <select class="aviz-mapping-select" data-field-id="${field.id}" style="${selectStyle()} font-size:11px; padding:2px 6px; min-width:80px;">
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

        // Prevent infinite recursion in cyclical graphs
        if (heap._visited === undefined) {
            Object.defineProperty(heap, '_visited', { value: new Set(), enumerable: false, configurable: true });
        }

        // OPT reference: ["REF", heapId]
        if (Array.isArray(val) && val[0] === 'REF') {
            const id = val[1];
            if (heap._visited.has(id)) return "..."; // Break cycle
            heap._visited.add(id);

            const obj = heap[id];
            if (!obj) {
                heap._visited.delete(id);
                return val;
            }
            const res = decodeHeapObject(obj, heap);
            heap._visited.delete(id);
            return res;
        }

        // Could also be a C_DATA or other special
        if (Array.isArray(val) && val[0] === 'C_DATA') {
            return val[2]; // Just return the raw value
        }

        // SometimesOPT returns dicts/lists INLINE instead of REF if small enough
        if (Array.isArray(val)) {
            return decodeHeapObject(val, heap);
        }

        return val;
    }
    window.Labyrinth.decodeHeapValue = decodeHeapValue;
    window.Labyrinth.layoutNodes = layoutNodes;
    window.Labyrinth.refreshMappingDropdowns = refreshMappingDropdowns;

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
                    const key = decodeHeapValue(pair[0], heap);
                    const val = decodeHeapValue(pair[1], heap);
                    if (key !== null && key !== undefined) {
                        dict[String(key)] = val;
                    }
                }
            }
            return dict;
        }

        if (tag === 'INSTANCE' || tag === 'CLASS') {
            const instance = { __type__: tag, __name__: obj[1] };
            // OPT stores instance attrs as: ['INSTANCE', 'ClassName', ['attr1', val1], ['attr2', val2], ...]
            for (let i = 2; i < obj.length; i++) {
                const pair = obj[i];
                if (Array.isArray(pair) && pair.length === 2) {
                    const attrName = String(pair[0]);
                    const attrVal = decodeHeapValue(pair[1], heap);
                    instance[attrName] = attrVal;
                }
            }
            return instance;
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
        let foundEdges = null;
        for (const [name, val] of Object.entries(State.detectedGlobals)) {
            if (name.startsWith('__')) continue;

            // Check flat arrays (tuples or dicts)
            if (Array.isArray(val) && val.length > 0) {
                const first = val[0];
                if (Array.isArray(first) && (first.length === 2 || first.length === 3)) {
                    foundEdges = name;
                } else if (typeof first === 'object' && first !== null && ('from' in first) && ('to' in first)) {
                    foundEdges = name;
                }
            }

            // Check class instances with .graph adjacency list (e.g. MultiGraph class)
            if (!foundEdges && val && typeof val === 'object' && !Array.isArray(val)) {
                var adjList = null;
                if (val.__type__ === 'INSTANCE' && val.graph && typeof val.graph === 'object') {
                    adjList = val.graph;
                } else if (!val.__type__ && Object.keys(val).length >= 2) {
                    // Plain dict that looks like adjacency list
                    var allArrays = true;
                    for (const v of Object.values(val)) {
                        if (!Array.isArray(v)) { allArrays = false; break; }
                    }
                    if (allArrays) adjList = val;
                }
                if (adjList && Object.keys(adjList).length >= 2) {
                    foundEdges = name;
                }
            }

            if (foundEdges && !State.mappings['edges']) {
                State.mappings['edges'] = foundEdges;
                layoutNodes();
                refreshMappingDropdowns();
                const selects = document.querySelectorAll('.aviz-mapping-select');
                selects.forEach(s => {
                    if (s.dataset.fieldId === 'edges') s.value = foundEdges;
                });
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

        const raw = State.detectedGlobals[edgesVar];
        if (!raw) return;

        const nodes = new Set();

        // Extract nodes from the raw value based on its format
        if (Array.isArray(raw)) {
            // Flat edge list (tuples or dicts)
            raw.forEach(e => {
                if (Array.isArray(e) && e.length >= 2) {
                    nodes.add(String(e[0]));
                    nodes.add(String(e[1]));
                } else if (e && typeof e === 'object' && 'from' in e && 'to' in e) {
                    nodes.add(String(e.from));
                    nodes.add(String(e.to));
                }
            });
        } else if (raw && typeof raw === 'object') {
            // Could be a class instance or plain adjacency list
            var adjList = null;
            if (raw.__type__ === 'INSTANCE' && raw.graph && typeof raw.graph === 'object') {
                adjList = raw.graph;
            } else if (!raw.__type__) {
                adjList = raw;
            }
            if (adjList) {
                for (const node of Object.keys(adjList)) {
                    nodes.add(String(node));
                    if (Array.isArray(adjList[node])) {
                        adjList[node].forEach(entry => {
                            if (Array.isArray(entry) && entry.length >= 1) {
                                nodes.add(String(entry[0]));
                            }
                        });
                    }
                }
            }
        }

        const nodesArr = [...nodes];
        if (nodesArr.length === 0) return;

        const W = State.canvas.width || 600;
        const H = State.canvas.height || 400;
        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.35;

        State.nodePositions = {};
        nodesArr.forEach((n, i) => {
            const angle = (2 * Math.PI * i / nodesArr.length) - Math.PI / 2;
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
        // Reset per-frame counters
        for (const k of Object.keys(drawnEdgesThisFrame)) delete drawnEdgesThisFrame[k];

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
            let u, v, w;
            if (Array.isArray(e) && e.length >= 2) {
                u = String(e[0]); v = String(e[1]); w = e.length >= 3 ? e[2] : '';
            } else if (e && typeof e === 'object' && 'from' in e && 'to' in e) {
                u = String(e.from); v = String(e.to); w = e.weight || '';
            } else return;

            const p1 = State.nodePositions[u], p2 = State.nodePositions[v];
            if (p1 && p2) {
                const arr = [u, v].sort();
                const key = arr.join('---') + (w ? '---' + w : '');
                drawLine(p1, p2, COLOR.edgeNone, 1.5, String(w), key);
            }
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

    // Track multiple edges to apply curve offsets
    const drawnEdgesThisFrame = {};

    function drawLine(p1, p2, color, width, label, key) {
        const { ctx } = State;

        // Use node positions to make a unique signature for counting
        const pairKey = [
            Math.round(p1.x) + ',' + Math.round(p1.y),
            Math.round(p2.x) + ',' + Math.round(p2.y)
        ].sort().join('-');

        // Auto-generate a unique key if none provided (backward compat for Kruskal/Dijkstra)
        if (key === undefined || key === null) {
            key = pairKey + '---auto---' + (label || '') + '---' + Math.random();
        }

        if (!drawnEdgesThisFrame[pairKey]) drawnEdgesThisFrame[pairKey] = 0;
        else if (drawnEdgesThisFrame[pairKey + '_keys'] && drawnEdgesThisFrame[pairKey + '_keys'].has(key)) {
            // deduplicate exact identical edge draw attempts (e.g if generic and algo both draw)
            return;
        }

        if (!drawnEdgesThisFrame[pairKey + '_keys']) drawnEdgesThisFrame[pairKey + '_keys'] = new Set();
        drawnEdgesThisFrame[pairKey + '_keys'].add(key);

        const instanceIndex = drawnEdgesThisFrame[pairKey]++;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);

        let mx, my;

        if (instanceIndex === 0) {
            // Straight line
            ctx.lineTo(p2.x, p2.y);
            mx = (p1.x + p2.x) / 2;
            my = (p1.y + p2.y) / 2;
        } else {
            // Bezier curve
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;

            // Alternating signed offsets
            const sign = instanceIndex % 2 === 0 ? -1 : 1;
            const magnitude = 30 * Math.ceil(instanceIndex / 2);

            const cx = (p1.x + p2.x) / 2 + nx * magnitude * sign;
            const cy = (p1.y + p2.y) / 2 + ny * magnitude * sign;

            ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);

            // Label pos for quadratic curve at t=0.5
            mx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
            my = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
        }

        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();

        if (label && label !== 'undefined') {
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
