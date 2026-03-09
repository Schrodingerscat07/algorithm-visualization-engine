# Multi-Weighted Graph Visualization

# Define the graph using a list of dictionaries
edges = [
    {"from": "A", "to": "B", "weight": 2},
    {"from": "A", "to": "C", "weight": 3},
    {"from": "B", "to": "C", "weight": 1},
    {"from": "B", "to": "D", "weight": 1},
    {"from": "B", "to": "D", "weight": 4},  # Multiple edge!
    {"from": "C", "to": "D", "weight": 4},
    {"from": "C", "to": "E", "weight": 5},
    {"from": "D", "to": "E", "weight": 1},
    {"from": "D", "to": "F", "weight": 2}
]

vertices = ["A", "B", "C", "D", "E", "F"]

# Variables for visualization mapping
highlight = None

# Simulate highlighting an edge
for edge in edges:
    highlight = edge
    # The visualization engine will pause here and show the edge highlighted in orange
    
highlight = None
