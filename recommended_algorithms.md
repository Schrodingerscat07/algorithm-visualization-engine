# Recommended Algorithms for AlgoVista

This file contains the recommended Python implementations for algorithms to visualize in the engine. These snippets include all the necessary state variables (like `edges`, `mst`, `current`) that the visualizer expects to track the state dynamically.

## Kruskal's Minimum Spanning Tree

```python
# Kruskal's Minimum Spanning Tree with a visualization variable

edges = [
    (1,2,2),
    (1,3,3),
    (2,3,1),
    (2,4,1),
    (3,4,4),
    (3,5,5),
    (4,5,1)
]

# Union–Find structures
parent = {i:i for i in range(1,6)}
rank = {i:0 for i in range(1,6)}

# Visualization state
mst = []
current = None        # edge currently being examined

def find(x):
    if parent[x] != x:
        parent[x] = find(parent[x])
    return parent[x]

def union(x,y):
    rx = find(x)
    ry = find(y)

    if rx == ry:
        return

    if rank[rx] < rank[ry]:
        parent[rx] = ry
    elif rank[rx] > rank[ry]:
        parent[ry] = rx
    else:
        parent[ry] = rx
        rank[rx] += 1

# Step 1: sort edges
edges.sort(key=lambda e: e[2])

V = 5

# Step 2: process edges
for edge in edges:

    current = edge           # visualization: edge being considered

    u, v, w = edge

    if len(mst) == V - 1:
        break

    if find(u) != find(v):
        mst.append(edge)
        union(u, v)

# cleanup visualization state
current = None

print("MST:", mst)
```
