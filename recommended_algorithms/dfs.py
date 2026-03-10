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
visited = set()
parent = {i: None for i in range(1, V+1)}
stack = [source]
current = None

while stack:
    # Look at the top of the stack
    u = stack.pop()
    current = u
    
    if u not in visited:
        visited.add(u)
        
        # Add neighbors to stack
        for v in reversed(graph[u]): # Reversed to maintain intuitive order
            if v not in visited:
                parent[v] = u
                stack.append(v)
                
# Cleanup visualization state
current = None

print("Visited order:", visited)
print("Parent tree:", parent)
