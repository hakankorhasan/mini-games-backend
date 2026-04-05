/**
 * Arrow Puzzle — Level Generator v6: Shaped Grids
 *
 * KEY FEATURES:
 *   - Non-rectangular play areas: diamond, circle, hexagon, heart, star, etc.
 *   - Up to 45 streams on large shapes
 *   - Constructive blocking chain → no DFS, guaranteed solvable
 *   - 500 levels, steep difficulty curve
 */

import {
    Cell, Direction, DirectionVector, StreamData,
    ArrowPuzzleLevel, DifficultyConfig, Grid,
} from "../types/arrowPuzzleTypes";
import { createSeededRandom, hashString } from "./numberCircuit";

export { createSeededRandom, hashString };

export const TOTAL_ARROW_PUZZLE_LEVELS = 500;

const COLORS: string[] = [
    "#29ECFF","#FF54DD","#B8FF4E","#FF8C3B","#9E5CFF","#FFE34D","#52FFBF",
    "#FF6F61","#FF3366","#00C9FF","#AAFF00","#FF00FF","#FF9900","#00FF99",
    "#FF6B9D","#06D6A0","#118AB2","#EF476F","#FFD166","#7400B8","#80B918",
    "#0077B6","#F18F01","#C77DFF","#E63946","#457B9D","#2A9D8F","#E9C46A",
    "#F4A261","#264653","#48BFE3","#56CFE1","#72EFDD","#5390D9","#7B2CBF",
    "#F72585","#B5179E","#560BAD","#480CA8","#3A0CA3","#3F37C9","#4361EE",
    "#4895EF","#4CC9F0","#780000",
];

const DV: Record<Direction, DirectionVector> = {
    up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0},
};
const ALL_D: Direction[] = ["up","down","left","right"];
const OPP: Record<Direction, Direction> = { up:"down", down:"up", left:"right", right:"left" };
function perps(d: Direction): Direction[] {
    return d==="up"||d==="down" ? ["left","right"] : ["up","down"];
}

// ─── Shape Generators ───────────────────────────────────────────

function diamond(n: number): Cell[] {
    const c = Math.floor(n/2), r = c;
    const out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++)
        if (Math.abs(x-c)+Math.abs(y-c)<=r) out.push({x,y});
    return out;
}

function circle(n: number): Cell[] {
    const c=(n-1)/2, r=c-0.4;
    const out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++)
        if ((x-c)**2+(y-c)**2<=r*r) out.push({x,y});
    return out;
}

function triangleUp(n: number): Cell[] {
    const cx=Math.floor(n/2), out: Cell[] = [];
    for (let y=0;y<n;y++) {
        const hw = Math.floor(y*cx/(n-1));
        for (let x=cx-hw;x<=cx+hw;x++) if (x>=0&&x<n) out.push({x,y});
    }
    return out;
}

function triangleDown(n: number): Cell[] {
    const cx=Math.floor(n/2), out: Cell[] = [];
    for (let y=0;y<n;y++) {
        const hw = Math.floor((n-1-y)*cx/(n-1));
        for (let x=cx-hw;x<=cx+hw;x++) if (x>=0&&x<n) out.push({x,y});
    }
    return out;
}

function hexagon(n: number): Cell[] {
    const cx=Math.floor(n/2), cy=Math.floor(n/2), r=Math.floor(n/2)-1;
    const out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
        const dy=Math.abs(y-cy), dx=Math.abs(x-cx);
        if (dy<=r && dx<=r && dx+Math.floor(dy/2)<=r) out.push({x,y});
    }
    return out;
}

function cross(n: number): Cell[] {
    const cx=Math.floor(n/2), arm=Math.max(1,Math.floor(n/4));
    const out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++)
        if (Math.abs(x-cx)<=arm || Math.abs(y-cx)<=arm) out.push({x,y});
    return out;
}

function heart(n: number): Cell[] {
    const cx=(n-1)/2, cy=(n-1)/2, out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
        const nx=(x-cx)/(n/2.5), ny=(cy-y)/(n/2.5);
        if ((nx*nx+ny*ny-1)**3 - nx*nx*ny*ny*ny <= 0.06) out.push({x,y});
    }
    return out;
}

function star(n: number): Cell[] {
    const cx=(n-1)/2, cy=(n-1)/2, R=cx*0.95, r=cx*0.38;
    const out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
        const dx=x-cx, dy=y-cy;
        const dist=Math.sqrt(dx*dx+dy*dy);
        let a=Math.atan2(dy,dx); if(a<0) a+=2*Math.PI;
        const sector = (a/(2*Math.PI))*5;
        const frac = sector - Math.floor(sector);
        const t = frac<=0.5 ? frac*2 : (1-frac)*2;
        const edgeDist = r + (R-r)*t;
        if (dist<=edgeDist+0.5) out.push({x,y});
    }
    return out;
}

function arrowRight(n: number): Cell[] {
    const cy=Math.floor(n/2), bodyW=Math.floor(n*0.55);
    const bodyH=Math.max(3,Math.floor(n*0.28));
    const out: Cell[] = [];
    for (let y=cy-Math.floor(bodyH/2);y<=cy+Math.floor(bodyH/2);y++)
        for (let x=0;x<bodyW;x++) if(y>=0&&y<n) out.push({x,y});
    for (let x=bodyW;x<n;x++) {
        const p=(x-bodyW)/(n-bodyW);
        const hh=Math.floor((n/2)*(1-p));
        for (let y=cy-hh;y<=cy+hh;y++) if(y>=0&&y<n) out.push({x,y});
    }
    return out;
}

function hourglass(n: number): Cell[] {
    const cx=Math.floor(n/2), cy=Math.floor(n/2), out: Cell[] = [];
    for (let y=0;y<n;y++) {
        const d=Math.abs(y-cy);
        const hw=Math.max(1, Math.floor(d*cx/cy));
        for (let x=cx-hw;x<=cx+hw;x++) if(x>=0&&x<n) out.push({x,y});
    }
    return out;
}

function donut(n: number): Cell[] {
    const c=(n-1)/2, R=c-0.4, r=R*0.4;
    const out: Cell[] = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
        const d=(x-c)**2+(y-c)**2;
        if (d<=R*R && d>=r*r) out.push({x,y});
    }
    return out;
}

const SHAPE_LIST = [
    "diamond","circle","triangleUp","hexagon","cross",
    "heart","star","arrowRight","hourglass","triangleDown","donut",
];
const SHAPE_FNS: Record<string,(_:number)=>Cell[]> = {
    diamond, circle, triangleUp, triangleDown,
    hexagon, cross, heart, star, arrowRight, hourglass, donut,
};

function pickShape(level: number, size: number): { name: string; cells: Cell[] } {
    // Small levels: simple shapes
    const pool = size < 12
        ? ["diamond","circle","triangleUp"]
        : SHAPE_LIST;
    const name = pool[(level - 1) % pool.length];
    return { name, cells: SHAPE_FNS[name](size) };
}

// ─── Difficulty ─────────────────────────────────────────────────

export function getDifficultyConfig(level: number): DifficultyConfig {
    if (level<=5) return {
        difficulty:"easy", gridSize:9,
        streamCountMin:4, streamCountMax:5,
        minSolutionLength:4, maxImmediateMoves:5,
        minTurns:1, minPathLength:4, minDensity:0.25, depthLimit:10,
    };
    if (level<=30) return {
        difficulty:"easy", gridSize:13,
        streamCountMin:6, streamCountMax:10,
        minSolutionLength:6, maxImmediateMoves:6,
        minTurns:1, minPathLength:6, minDensity:0.30, depthLimit:15,
    };
    if (level<=100) return {
        difficulty:"medium", gridSize:18,
        streamCountMin:10, streamCountMax:16,
        minSolutionLength:10, maxImmediateMoves:8,
        minTurns:1, minPathLength:7, minDensity:0.30, depthLimit:20,
    };
    if (level<=250) return {
        difficulty:"hard", gridSize:24,
        streamCountMin:16, streamCountMax:25,
        minSolutionLength:14, maxImmediateMoves:10,
        minTurns:1, minPathLength:7, minDensity:0.30, depthLimit:25,
    };
    if (level<=400) return {
        difficulty:"expert", gridSize:30,
        streamCountMin:16, streamCountMax:24,
        minSolutionLength:14, maxImmediateMoves:12,
        minTurns:1, minPathLength:7, minDensity:0.25, depthLimit:30,
    };
    return {
        difficulty:"master", gridSize:35,
        streamCountMin:22, streamCountMax:32,
        minSolutionLength:18, maxImmediateMoves:14,
        minTurns:1, minPathLength:7, minDensity:0.25, depthLimit:35,
    };
}

// ─── Helpers ────────────────────────────────────────────────────

function gin(g: Grid, c: Cell) { return c.x>=0&&c.x<g.cols&&c.y>=0&&c.y<g.rows; }
function ck(c: Cell) { return `${c.x}.${c.y}`; }

/** Head ray through active cells only. Stops at first non-active cell. */
function headRayActive(head: Cell, dir: Direction, activeSet: Set<string>, grid: Grid): Cell[] {
    const v=DV[dir]; const ray: Cell[] = [];
    let x=head.x+v.dx, y=head.y+v.dy;
    while (gin(grid,{x,y}) && activeSet.has(`${x}.${y}`)) {
        ray.push({x,y}); x+=v.dx; y+=v.dy;
    }
    return ray;
}

/** Distance from cell to shape boundary in given direction */
function distToEdge(cell: Cell, dir: Direction, activeSet: Set<string>, grid: Grid): number {
    const v=DV[dir]; let d=0;
    let x=cell.x+v.dx, y=cell.y+v.dy;
    while (gin(grid,{x,y}) && activeSet.has(`${x}.${y}`)) { d++; x+=v.dx; y+=v.dy; }
    return d;
}

/** Can stream exit solo without self-blocking? (Shape-aware) */
function canExitSolo(cells: Cell[], dir: Direction, activeSet: Set<string>, grid: Grid): boolean {
    const v=DV[dir];
    const sim = cells.map(c => ({...c}));
    const maxTicks = cells.length + grid.cols + grid.rows;
    for (let t=0; t<maxTicks; t++) {
        const h = sim[sim.length-1];
        const nh: Cell = {x:h.x+v.dx, y:h.y+v.dy};
        // Self-blocking only matters if nextHead is inside active area
        if (gin(grid,nh) && activeSet.has(ck(nh))) {
            for (let i=1;i<sim.length;i++)
                if (sim[i].x===nh.x && sim[i].y===nh.y) return false;
        }
        sim.shift(); sim.push(nh);
        // Exited if no cell is in active area
        if (!sim.some(c => gin(grid,c) && activeSet.has(ck(c)))) return true;
    }
    return false;
}

// ─── Path Generation ────────────────────────────────────────────

function generatePath(
    activeSet: Set<string>, activeCells: Cell[], grid: Grid,
    dir: Direction, occupied: Set<string>,
    config: DifficultyConfig, rand: () => number,
    _headDistMin: number, _headDistMax: number
): Cell[] | null {
    // Quickly pick a random head: try random active cells and check edge distance
    let head: Cell | null = null;
    for (let t = 0; t < 60; t++) {
        const c = activeCells[Math.floor(rand() * activeCells.length)];
        if (occupied.has(ck(c))) continue;
        const d = distToEdge(c, dir, activeSet, grid);
        if (d >= _headDistMin && d <= _headDistMax) { head = c; break; }
    }
    if (!head) return null;

    const cells: Cell[] = [head];
    const used = new Set<string>([ck(head)]);
    let curDir = OPP[dir];

    const base = config.minPathLength + Math.floor(config.gridSize * 0.5);
    const target = base + Math.floor(rand() * Math.floor(base * 0.8));

    for (let step = 0; step < target - 1; step++) {
        const tail = cells[0];
        let nd: Direction;

        // CRITICAL: First step MUST go in OPP[dir] so that the
        // segment into the head visually matches the stream direction.
        // If this cell is not available, reject the entire path.
        if (step === 0) {
            const v = DV[curDir]; // curDir = OPP[dir]
            const nc: Cell = {x: tail.x+v.dx, y: tail.y+v.dy};
            if (activeSet.has(ck(nc)) && !used.has(ck(nc)) && !occupied.has(ck(nc))) {
                cells.unshift(nc); used.add(ck(nc)); /* curDir stays */ 
                continue;
            }
            return null; // Can't align head direction → reject
        }

        if (rand() < 0.60) {
            const ps = perps(curDir);
            nd = ps[Math.floor(rand() * ps.length)];
        } else { nd = curDir; }

        const tryDirs = [nd, ...ALL_D.filter(d => d !== OPP[curDir] && d !== nd)];
        let placed = false;
        for (const d of tryDirs) {
            const v = DV[d];
            const nc: Cell = {x: tail.x+v.dx, y: tail.y+v.dy};
            if (activeSet.has(ck(nc)) && !used.has(ck(nc)) && !occupied.has(ck(nc))) {
                cells.unshift(nc); used.add(ck(nc)); curDir = d; placed = true; break;
            }
        }
        if (!placed) break;
    }

    if (cells.length < config.minPathLength) return null;
    if (!canExitSolo(cells, dir, activeSet, grid)) return null;
    return cells;
}

// ─── Constructive Builder ───────────────────────────────────────

function tryBuild(
    levelNumber: number, config: DifficultyConfig,
    grid: Grid, activeSet: Set<string>, activeCells: Cell[],
    shapeName: string, rand: () => number
): ArrowPuzzleLevel | null {
    const sc = config.streamCountMin +
        Math.floor(rand() * (config.streamCountMax - config.streamCountMin + 1));

    const colorPool = [...COLORS];
    for (let i=colorPool.length-1;i>0;i--) {
        const j=Math.floor(rand()*(i+1));
        [colorPool[i],colorPool[j]]=[colorPool[j],colorPool[i]];
    }

    const occupied = new Set<string>();
    const built: {cells:Cell[];direction:Direction;id:string;color:string}[] = [];

    for (let i=0; i<sc; i++) {
        const dir = ALL_D[Math.floor(rand() * 4)];
        let bestPath: Cell[] | null = null;

        // Head distance: 0-10 for all streams (let the system place where it can)
        const hMin = 0;
        const hMax = Math.min(12, Math.floor(config.gridSize / 2));

        for (let attempt = 0; attempt < 80; attempt++) {
            const path = generatePath(activeSet, activeCells, grid, dir, occupied, config, rand, hMin, hMax);
            if (!path) continue;

            if (i === 0 || built.length === 0) { bestPath = path; break; }

            // Check blocking: path must have cell on prev stream's head ray
            const prev = built[built.length - 1];
            const ray = headRayActive(prev.cells[prev.cells.length-1], prev.direction, activeSet, grid);
            const raySet = new Set(ray.map(ck));
            if (path.some(c => raySet.has(ck(c)))) { bestPath = path; break; }

            // Fallback: accept after many failed attempts
            if (attempt > 25) { bestPath = path; break; }
        }

        // If couldn't place this stream, just skip it (don't fail the entire build)
        if (!bestPath) continue;

        built.push({
            cells: bestPath, direction: dir,
            id: `stream-${i+1}`, color: colorPool[i % colorPool.length],
        });
        for (const c of bestPath) occupied.add(ck(c));
    }

    // ─── Greedy solver: find a valid firing order and detect deadlocks ───
    const remaining = built.map(b => ({ ...b }));
    const solution: string[] = [];

    while (remaining.length > 0) {
        let found = false;
        for (let i = 0; i < remaining.length; i++) {
            const s = remaining[i];
            // Collect all cells from OTHER remaining streams
            const otherCells = new Set<string>();
            for (let j = 0; j < remaining.length; j++) {
                if (j === i) continue;
                for (const c of remaining[j].cells) otherCells.add(ck(c));
            }
            // Check: head ray clear within active area?
            const ray = headRayActive(s.cells[s.cells.length - 1], s.direction, activeSet, grid);
            const blocked = ray.some(c => otherCells.has(ck(c)));
            if (!blocked) {
                solution.push(s.id);
                remaining.splice(i, 1);
                found = true;
                break;
            }
        }
        if (!found) return null; // DEADLOCK — reject this level
    }

    const totalCells = built.reduce((s,b) => s+b.cells.length, 0);
    const streams: StreamData[] = built.map(b => ({
        id:b.id, label:b.id.replace("stream-","Stream "),
        color:b.color, direction:b.direction, cells:b.cells,
    }));

    return {
        levelNumber, gameType:".pathClearing",
        difficulty:config.difficulty,
        difficultyScore: Math.min(100, Math.round(built.length*2 + totalCells/activeCells.length*30)),
        grid, activeCells, shapeName, streams, solution,
    };
}

// ─── Public API ─────────────────────────────────────────────────

export function generateLevel(levelNumber: number, rand: () => number): ArrowPuzzleLevel | null {
    const config = getDifficultyConfig(levelNumber);
    const { name: shapeName, cells: activeArr } = pickShape(levelNumber, config.gridSize);
    const grid: Grid = { cols: config.gridSize, rows: config.gridSize };
    const activeSet = new Set(activeArr.map(ck));

    for (let a = 0; a < 200; a++) {
        const r = tryBuild(levelNumber, config, grid, activeSet, activeArr, shapeName, rand);
        if (r) return r;
    }

    // Fallback: relax stream counts
    const relaxed: DifficultyConfig = {
        ...config,
        minPathLength: Math.max(3, config.minPathLength - 3),
        streamCountMin: Math.max(3, config.streamCountMin - 8),
        streamCountMax: Math.max(4, config.streamCountMax - 8),
    };
    for (let a = 0; a < 150; a++) {
        const r = tryBuild(levelNumber, relaxed, grid, activeSet, activeArr, shapeName, rand);
        if (r) return r;
    }

    // Last resort
    const relaxed2: DifficultyConfig = {
        ...config,
        minPathLength: 3, minTurns: 0,
        streamCountMin: Math.max(3, config.streamCountMin - 16),
        streamCountMax: Math.max(4, config.streamCountMax - 16),
    };
    for (let a = 0; a < 150; a++) {
        const r = tryBuild(levelNumber, relaxed2, grid, activeSet, activeArr, shapeName, rand);
        if (r) return r;
    }
    return null;
}

export function generateLevels(startFrom: number, count: number): ArrowPuzzleLevel[] {
    const levels: ArrowPuzzleLevel[] = [];
    for (let i = 0; i < count; i++) {
        const n = startFrom + i;
        const seed = hashString(`ArrowPuzzle-level-${n}`);
        const rand = createSeededRandom(seed);
        const level = generateLevel(n, rand);
        if (level) levels.push(level);
    }
    return levels;
}
