# Labyrinth — Computational Algorithm Visualization Engine

A **live, interactive algorithm visualization platform** built as an extension of [Python Tutor](http://pythontutor.com/) by [Philip Guo](https://github.com/pgbovine/OnlinePythonTutor). It combines Python Tutor's powerful step-by-step execution tracing with a real-time graph visualization engine, enabling users to see algorithms like Kruskal's MST come to life as they write Python code.

---

## 🙏 Credits & Acknowledgements

This project is built on top of and extends the following open-source work:

| Project | Author | Role |
|---|---|---|
| **[Python Tutor](http://pythontutor.com/)** | **Philip Guo** ([pgbovine](https://github.com/pgbovine/OnlinePythonTutor)) | Original execution visualization framework. The core trace engine (`opt-live.bundle.js`) and step-by-step debugging UI are his work. |
| **[live-py-tutor](https://github.com/livinNector/live-py-tutor)** | **Livin Nector** ([livinNector](https://github.com/livinNector)) | Pyodide-based live programming mode that runs Python Tutor entirely in the browser. This repo was forked from his implementation. |

> **This application would not exist without the foundational work of Python Tutor.** Labyrinth adds an algorithm visualization layer on top of it — all credit for the execution tracing, frame/object rendering, and live programming infrastructure belongs to the original authors above.

---

## ✨ What Labyrinth Adds

While Python Tutor shows you *how your code executes*, Labyrinth shows you *what your algorithm is doing* — visually, in real-time.

### Key Features
- **📊 Live Graph Visualization** — Write edge lists in Python, see the graph rendered on a canvas instantly
- **🔗 Variable Mapping** — Map your Python variables (`edges`, `mst`, `parent`) to visualization components via dropdowns
- **⬡ Algorithm Plugins** — Modular architecture: each algorithm (Kruskal's MST, etc.) is a separate JS file
- **↔️ Resizable Dual-Pane Layout** — Drag the splitter to resize the Data State and Algorithm Visualization panels
- **🔍 OPT Heap Decoder** — Recursively decodes Python Tutor's trace format (`REF`, `LIST`, `TUPLE`, `DICT`) into real JavaScript values for accurate variable detection
- **🎨 Clean White Theme** — Professional, industry-grade UI design

### Inherited from Python Tutor
- Step-by-step execution visualization
- Frame & object rendering (lists, tuples, dicts, sets)
- Pointer arrows between frames and heap objects
- Slider and VCR controls for stepping through execution
- Live programming mode (code runs as you type)

---

## 🚀 Getting Started

### Prerequisites
- Python 3.x (for the local dev server)

### Run Locally
```bash
# Clone the repository
git clone https://github.com/Schrodingerscat07/algorithm-visualization-engine.git
cd algorithm-visualization-engine

# Start the server
python run.py
```

Open your browser to `http://localhost:8003` (or the port shown in the terminal).

### Try It Out
Paste this code into the editor:
```python
edges = [(0,1,4),(0,2,3),(1,2,1),(1,3,2),(2,3,5),(3,4,6)]
```

1. Select an algorithm (**Kruskal's MST** or **Dijkstra's**) from the Algorithm dropdown
2. Map the `edges` variable to **All Edges**
3. Watch the graph render on the canvas!

---

## 📁 Project Structure

```
├── index.html          # Main HTML with resizable dual-pane layout
├── algo-core.js        # Core engine: UI, trace interception, heap decoder, resizer
├── algo-kruskal.js     # Kruskal's MST visualization plugin
├── opt-live.bundle.js  # Python Tutor's bundled execution engine (original)
├── run.py              # Local development server
├── LICENSE             # MIT License
└── README.md           # This file
```

---

## 🧩 Adding New Algorithms

Create a new file (e.g., `algo-dijkstra.js`) and register it:

```javascript
window.Labyrinth.registerAlgorithm({
  id: 'dijkstra',
  name: "Dijkstra's Shortest Path",
  fields: [
    { id: 'edges', label: 'Graph Edges [(u,v,w),...]', type: 'graph' },
    { id: 'dist',  label: 'Distance Array', type: 'list' },
  ],
  render(ctx, state, globals) {
    // Your rendering logic here
    // Use state.mappings, state.nodePositions, globals
    // Use Labyrinth.drawNode() and Labyrinth.drawLine()
  }
});
```

Include the script in `index.html` with `defer`:
```html
<script type="text/javascript" src="algo-dijkstra.js" defer></script>
```

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

**Original Python Tutor** is copyright © Philip Guo, licensed under its [own terms](https://github.com/pgbovine/OnlinePythonTutor/blob/master/LICENSE.txt).  
**live-py-tutor** is copyright © 2024 Livin Nector, MIT License.
