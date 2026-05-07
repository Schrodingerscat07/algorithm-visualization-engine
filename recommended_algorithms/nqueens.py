# N-Queens Problem — Backtracking Visualization
# Structured for Labyrinth algorithm visualization engine

# Board size (N×N)
N = 4

# Board state: board[row] = column where queen is placed (-1 = empty)
board = [-1] * N

# Visualization state variables
current_row = None          # row currently being processed
current_col = None          # column currently being tried
conflict_cell = None        # (row, col) that caused a conflict
placed_queens = []          # list of (row, col) for successfully placed queens
backtrack_from = None       # row we're backtracking FROM
is_safe_checking = None     # (row, col) being safety-checked
all_solutions = []          # all completed solutions found
solution_count = 0          # number of solutions found so far
status = "idle"             # "placing", "checking", "conflict", "backtrack", "solved"


def is_safe(board, row, col):
    """Check if placing a queen at (row, col) is safe."""
    global is_safe_checking
    is_safe_checking = (row, col)

    for prev_row in range(row):
        prev_col = board[prev_row]
        if prev_col == -1:
            continue

        # Same column check
        if prev_col == col:
            return False

        # Diagonal check
        if abs(prev_col - col) == abs(prev_row - row):
            return False

    return True


def solve_nqueens(row):
    """Solve N-Queens using backtracking, exposing variables for visualization."""
    global current_row, current_col, conflict_cell
    global placed_queens, backtrack_from, status
    global all_solutions, solution_count, is_safe_checking

    current_row = row

    # Base case: all queens placed successfully
    if row == N:
        status = "solved"
        solution = [(r, board[r]) for r in range(N)]
        all_solutions.append(solution)
        solution_count = len(all_solutions)
        placed_queens = list(solution)
        return

    for col in range(N):
        current_col = col
        status = "checking"
        conflict_cell = None

        if is_safe(board, row, col):
            # Place queen
            board[row] = col
            status = "placing"

            placed_queens = [(r, board[r]) for r in range(row + 1) if board[r] != -1]

            # Recurse to next row
            solve_nqueens(row + 1)

            # Backtrack: remove queen
            backtrack_from = row
            board[row] = -1
            status = "backtrack"

            placed_queens = [(r, board[r]) for r in range(row) if board[r] != -1]

        else:
            # Record conflict
            status = "conflict"
            conflict_cell = (row, col)


# Run the solver
solve_nqueens(0)

# Cleanup visualization state
current_row = None
current_col = None
conflict_cell = None
backtrack_from = None
is_safe_checking = None
status = "complete"

print(f"Total solutions found for {N}-Queens: {solution_count}")
for i, sol in enumerate(all_solutions):
    print(f"Solution {i + 1}: {sol}")
