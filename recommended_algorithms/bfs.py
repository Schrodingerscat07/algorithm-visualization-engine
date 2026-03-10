from collections import deque

edges = [
    (1, 2),
    (1, 3),
    (2, 4),
    (2, 5),
    (3, 6),
    (3, 7)
]

V = 7
source = 1

# Build adjacency list
graph = {i: [] for i in range(1, V+1)}
for u, v in edges:
    graph[u].append(v)
    graph[v].append(u)

# Visualization states
visited = {source}
parent = {i: None for i in range(1, V+1)}
queue = deque([source])
current = None

while queue:
    u = queue.popleft()
    current = u
    
    for v in graph[u]:
        if v not in visited:
            visited.add(v)
            parent[v] = u
            queue.append(v)

# Cleanup visualization state
current = None

print("Visited set:", visited)
print("Parent tree:", parent)
