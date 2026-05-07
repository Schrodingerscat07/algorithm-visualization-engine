/**
 * algo-nqueens.js
 * N-Queens Backtracking Visualization Plugin for Labyrinth.
 * Renders an N×N chessboard with queens, conflict highlights,
 * threat lines, and backtracking state.
 */

(function () {
    'use strict';

    if (!window.Labyrinth) {
        console.error("Labyrinth core not found. algo-nqueens.js must be loaded after algo-core.js");
        return;
    }

    const { COLORS, State } = window.Labyrinth;

    // ── Color Palette ────────────────────────────────────────────────────────
    const BOARD = {
        light: '#f0d9b5',
        dark: '#b58863',
        border: '#5d4037',
        coordText: '#666666',
        queenColor: '#1a1a1a',
    };

    const CELL_STATE = {
        placed: { fill: 'rgba(76, 175, 80, 0.35)', stroke: '#388e3c' },
        current: { fill: 'rgba(255, 152, 0, 0.40)', stroke: '#e65100' },
        conflict: { fill: 'rgba(244, 67, 54, 0.40)', stroke: '#c62828' },
        backtrack: { fill: 'rgba(156, 39, 176, 0.30)', stroke: '#7b1fa2' },
        solved: { fill: 'rgba(21, 101, 192, 0.30)', stroke: '#1565c0' },
        threat: 'rgba(244, 67, 54, 0.08)',
    };

    // ── Registration ─────────────────────────────────────────────────────────
    window.Labyrinth.registerAlgorithm({
        id: 'nqueens',
        name: "N-Queens (Backtracking)",
        fields: [
            { id: 'N', label: 'Board Size (N)', type: 'any' },
            { id: 'board', label: 'Board State (List)', type: 'any' },
            { id: 'placed_queens', label: 'Placed Queens (List)', type: 'any' },
            { id: 'current_row', label: 'Current Row', type: 'any' },
            { id: 'current_col', label: 'Current Col', type: 'any' },
            { id: 'conflict_cell', label: 'Conflict Cell (Tuple)', type: 'any' },
            { id: 'status', label: 'Status (String)', type: 'any' },
            { id: 'solution_count', label: 'Solution Count', type: 'any' },
        ],

        // ── Custom N×N grid layout ───────────────────────────────────────────
        layout(state, globals) {
            const nVar = state.mappings['N'];
            if (!nVar) return;

            const N = parseInt(globals[nVar]) || 4;
            const W = State.canvas.width || 600;
            const H = State.canvas.height || 400;

            const padX = 50;
            const padY = 40;
            const statusBarHeight = 50;
            const maxCellSize = 80;

            const cellSize = Math.min(
                (W - 2 * padX) / N,
                (H - padY - statusBarHeight) / N,
                maxCellSize
            );

            const boardWidth = cellSize * N;
            const boardHeight = cellSize * N;
            const offsetX = (W - boardWidth) / 2;
            const offsetY = padY;

            // Store grid metadata for render()
            this._grid = {
                N,
                cellSize,
                offsetX,
                offsetY,
                boardWidth,
                boardHeight,
            };

            // Populate nodePositions so algo-core.js doesn't think the layout is empty
            State.nodePositions = {};
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    State.nodePositions[`${r},${c}`] = {
                        x: offsetX + c * cellSize + cellSize / 2,
                        y: offsetY + r * cellSize + cellSize / 2,
                    };
                }
            }
        },

        // ── Render ───────────────────────────────────────────────────────────
        render(ctx, state, globals) {
            const nVar = state.mappings['N'];
            if (!nVar) return;

            const N = parseInt(globals[nVar]) || 4;

            // Relayout if grid not computed or N changed
            if (!this._grid || this._grid.N !== N) {
                this.layout(state, globals);
            }

            const grid = this._grid;
            if (!grid) return;

            const { cellSize, offsetX, offsetY, boardWidth, boardHeight } = grid;

            // ── Read mapped variables ────────────────────────────────────────
            const boardState = globals[state.mappings['board']] || [];
            const placedQueens = globals[state.mappings['placed_queens']] || [];
            const currentRow = globals[state.mappings['current_row']];
            const currentCol = globals[state.mappings['current_col']];
            const conflictCell = globals[state.mappings['conflict_cell']];
            const status = globals[state.mappings['status']] || 'idle';
            const solutionCount = globals[state.mappings['solution_count']] || 0;

            // Build a set of placed queen positions for fast lookup
            const queenSet = new Set();
            if (Array.isArray(placedQueens)) {
                placedQueens.forEach(q => {
                    if (Array.isArray(q) && q.length >= 2) {
                        queenSet.add(`${q[0]},${q[1]}`);
                    }
                });
            }

            const hasCurrent = currentRow !== null && currentRow !== undefined
                && currentCol !== null && currentCol !== undefined;

            const hasConflict = Array.isArray(conflictCell) && conflictCell.length >= 2;

            // ── LAYER 1: Chessboard grid ─────────────────────────────────────
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = offsetX + c * cellSize;
                    const y = offsetY + r * cellSize;
                    ctx.fillStyle = (r + c) % 2 === 0 ? BOARD.light : BOARD.dark;
                    ctx.fillRect(x, y, cellSize, cellSize);
                }
            }

            // ── LAYER 2: Threat line overlays ────────────────────────────────
            if (hasCurrent && (status === 'checking' || status === 'placing')) {
                const cr = parseInt(currentRow);
                const cc = parseInt(currentCol);

                ctx.fillStyle = CELL_STATE.threat;

                for (let r = 0; r < N; r++) {
                    for (let c = 0; c < N; c++) {
                        if (r === cr && c === cc) continue; // skip the current cell itself
                        // Same row, same column, or same diagonal
                        if (r === cr || c === cc || Math.abs(r - cr) === Math.abs(c - cc)) {
                            const x = offsetX + c * cellSize;
                            const y = offsetY + r * cellSize;
                            ctx.fillRect(x, y, cellSize, cellSize);
                        }
                    }
                }
            }

            // ── LAYER 3: Cell state highlights ───────────────────────────────

            // 3a: Backtrack row highlight
            const backtrackRow = globals[state.mappings['current_row']];
            if (status === 'backtrack' && backtrackRow !== null && backtrackRow !== undefined) {
                const br = parseInt(backtrackRow);
                for (let c = 0; c < N; c++) {
                    const x = offsetX + c * cellSize;
                    const y = offsetY + br * cellSize;
                    ctx.fillStyle = CELL_STATE.backtrack.fill;
                    ctx.fillRect(x, y, cellSize, cellSize);
                }
            }

            // 3b: Placed queen cells
            queenSet.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                const x = offsetX + c * cellSize;
                const y = offsetY + r * cellSize;
                ctx.fillStyle = CELL_STATE.placed.fill;
                ctx.fillRect(x, y, cellSize, cellSize);
            });

            // 3c: Current try cell
            if (hasCurrent) {
                const x = offsetX + parseInt(currentCol) * cellSize;
                const y = offsetY + parseInt(currentRow) * cellSize;
                ctx.fillStyle = CELL_STATE.current.fill;
                ctx.fillRect(x, y, cellSize, cellSize);

                // Orange border around current cell
                ctx.strokeStyle = CELL_STATE.current.stroke;
                ctx.lineWidth = 3;
                ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
            }

            // 3d: Conflict cell
            if (hasConflict) {
                const cr = parseInt(conflictCell[0]);
                const cc = parseInt(conflictCell[1]);
                const x = offsetX + cc * cellSize;
                const y = offsetY + cr * cellSize;
                ctx.fillStyle = CELL_STATE.conflict.fill;
                ctx.fillRect(x, y, cellSize, cellSize);

                // Red border
                ctx.strokeStyle = CELL_STATE.conflict.stroke;
                ctx.lineWidth = 3;
                ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
            }

            // ── LAYER 4: Grid lines & border ─────────────────────────────────
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            for (let r = 0; r <= N; r++) {
                ctx.beginPath();
                ctx.moveTo(offsetX, offsetY + r * cellSize);
                ctx.lineTo(offsetX + boardWidth, offsetY + r * cellSize);
                ctx.stroke();
            }
            for (let c = 0; c <= N; c++) {
                ctx.beginPath();
                ctx.moveTo(offsetX + c * cellSize, offsetY);
                ctx.lineTo(offsetX + c * cellSize, offsetY + boardHeight);
                ctx.stroke();
            }

            // Outer border
            ctx.strokeStyle = BOARD.border;
            ctx.lineWidth = 3;
            ctx.strokeRect(offsetX, offsetY, boardWidth, boardHeight);

            // ── LAYER 5: Queen symbols ───────────────────────────────────────
            const queenFontSize = Math.max(12, cellSize * 0.55);
            ctx.font = `bold ${queenFontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            queenSet.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                const cx = offsetX + c * cellSize + cellSize / 2;
                const cy = offsetY + r * cellSize + cellSize / 2;

                // Queen shadow for depth
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fillText('♛', cx + 1.5, cy + 2);

                // Determine queen color based on status
                let qColor = CELL_STATE.placed.stroke; // default green
                if (status === 'solved' || status === 'complete') {
                    qColor = CELL_STATE.solved.stroke; // blue for solution
                }

                ctx.fillStyle = qColor;
                ctx.fillText('♛', cx, cy);
            });

            // Draw the "trying" queen at current position (semi-transparent)
            if (hasCurrent && (status === 'checking' || status === 'placing')) {
                const cr = parseInt(currentRow);
                const cc = parseInt(currentCol);
                const qKey = `${cr},${cc}`;
                if (!queenSet.has(qKey)) {
                    const cx = offsetX + cc * cellSize + cellSize / 2;
                    const cy = offsetY + cr * cellSize + cellSize / 2;
                    ctx.globalAlpha = 0.45;
                    ctx.fillStyle = CELL_STATE.current.stroke;
                    ctx.fillText('♛', cx, cy);
                    ctx.globalAlpha = 1.0;
                }
            }

            // Draw conflict "X" marker
            if (hasConflict && status === 'conflict') {
                const cr = parseInt(conflictCell[0]);
                const cc = parseInt(conflictCell[1]);
                const cx = offsetX + cc * cellSize + cellSize / 2;
                const cy = offsetY + cr * cellSize + cellSize / 2;

                const xSize = cellSize * 0.25;
                ctx.strokeStyle = CELL_STATE.conflict.stroke;
                ctx.lineWidth = 3.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx - xSize, cy - xSize);
                ctx.lineTo(cx + xSize, cy + xSize);
                ctx.moveTo(cx + xSize, cy - xSize);
                ctx.lineTo(cx - xSize, cy + xSize);
                ctx.stroke();
                ctx.lineCap = 'butt';
            }

            // ── LAYER 6: Coordinate labels ───────────────────────────────────
            ctx.fillStyle = BOARD.coordText;
            ctx.font = 'bold 11px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let c = 0; c < N; c++) {
                // Column numbers on top
                ctx.fillText(String(c), offsetX + c * cellSize + cellSize / 2, offsetY - 14);
            }

            ctx.textAlign = 'right';
            for (let r = 0; r < N; r++) {
                // Row numbers on left
                ctx.fillText(String(r), offsetX - 10, offsetY + r * cellSize + cellSize / 2);
            }

            // ── LAYER 7: Status panel ────────────────────────────────────────
            const panelY = offsetY + boardHeight + 16;

            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // Status badge
            const statusColors = {
                idle: '#888',
                checking: '#ff9800',
                placing: '#4caf50',
                conflict: '#f44336',
                backtrack: '#9c27b0',
                solved: '#1565c0',
                complete: '#2e7d32',
            };

            const statusLabels = {
                idle: '⏸ Idle',
                checking: '🔍 Checking',
                placing: '✅ Placing',
                conflict: '❌ Conflict',
                backtrack: '↩️ Backtrack',
                solved: '🎉 Solution Found',
                complete: '✅ Complete',
            };

            const badgeColor = statusColors[status] || '#888';
            const badgeLabel = statusLabels[status] || status;

            // Background pill for status
            ctx.font = 'bold 12px Segoe UI, sans-serif';
            const badgeText = `${badgeLabel}`;
            const badgeWidth = ctx.measureText(badgeText).width + 20;
            const badgeX = offsetX;

            ctx.fillStyle = badgeColor;
            ctx.globalAlpha = 0.12;
            roundRect(ctx, badgeX, panelY, badgeWidth, 24, 12);
            ctx.fill();
            ctx.globalAlpha = 1.0;

            ctx.fillStyle = badgeColor;
            ctx.fillText(badgeText, badgeX + 10, panelY + 5);

            // Solution counter
            ctx.fillStyle = '#555';
            ctx.font = '12px Segoe UI, sans-serif';
            ctx.fillText(
                `Solutions: ${solutionCount}`,
                badgeX + badgeWidth + 16,
                panelY + 5
            );

            // Board config
            ctx.fillStyle = '#999';
            ctx.font = '11px Segoe UI, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(
                `${N}×${N} Board`,
                offsetX + boardWidth,
                panelY + 6
            );

            // ── LAYER 8: Description text ────────────────────────────────────
            const desc = document.getElementById('aviz-description');
            if (desc) {
                if (status === 'checking' && hasCurrent) {
                    desc.innerHTML = `🔍 Checking if position <b>(${currentRow}, ${currentCol})</b> is safe for a queen...`;
                } else if (status === 'placing' && hasCurrent) {
                    desc.innerHTML = `✅ Safe! Placing queen at <b>(${currentRow}, ${currentCol})</b>. Moving to row ${parseInt(currentRow) + 1}.`;
                } else if (status === 'conflict' && hasConflict) {
                    desc.innerHTML = `❌ <b>Conflict</b> at <b>(${conflictCell[0]}, ${conflictCell[1]})</b> — a queen already attacks this cell. Trying next column.`;
                } else if (status === 'backtrack') {
                    desc.innerHTML = `↩️ <b>Backtracking</b> from row <b>${currentRow}</b>. Removing queen and trying next option.`;
                } else if (status === 'solved') {
                    desc.innerHTML = `🎉 <b>Solution #${solutionCount} found!</b> All ${N} queens placed safely. Continuing to find more...`;
                } else if (status === 'complete') {
                    desc.innerHTML = `✅ <b>All solutions found:</b> ${solutionCount} total solution${solutionCount !== 1 ? 's' : ''} for the ${N}-Queens problem.`;
                } else {
                    desc.innerHTML = `N-Queens Backtracking Visualization. Map your variables above to begin.`;
                }
            }
        }
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Draw a rounded rectangle path */
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

})();
