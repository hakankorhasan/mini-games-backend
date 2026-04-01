import { StarBattleLevel } from "../types/starBattleTypes";
import { createSeededRandom, hashString } from "./numberCircuit";

// Re-export for convenience
export { createSeededRandom, hashString };

interface StarBattleTierDef {
    minLevel: number;
    maxLevel: number;
    gridSize: number;
    beaconsPerUnit: number;
    difficulty: string;
    difficultyRange: [number, number];
}

const LEVEL_TIERS: StarBattleTierDef[] = [
    { minLevel: 1, maxLevel: 20, gridSize: 5, beaconsPerUnit: 1, difficulty: "tutorial", difficultyRange: [1, 2] },
    { minLevel: 21, maxLevel: 60, gridSize: 6, beaconsPerUnit: 1, difficulty: "easy", difficultyRange: [2, 3] },
    { minLevel: 61, maxLevel: 150, gridSize: 8, beaconsPerUnit: 1, difficulty: "intermediate", difficultyRange: [3, 5] },
    { minLevel: 151, maxLevel: 250, gridSize: 10, beaconsPerUnit: 1, difficulty: "advanced", difficultyRange: [5, 6] },
    { minLevel: 251, maxLevel: 380, gridSize: 10, beaconsPerUnit: 2, difficulty: "hard", difficultyRange: [6, 8] },
    { minLevel: 381, maxLevel: 450, gridSize: 10, beaconsPerUnit: 2, difficulty: "expert", difficultyRange: [8, 9] },
    { minLevel: 451, maxLevel: 500, gridSize: 12, beaconsPerUnit: 2, difficulty: "master", difficultyRange: [9, 10] },
];

export function getTierConfig(levelNumber: number): { gridSize: number; beaconsPerUnit: number; difficulty: string; difficultyValue: number } | null {
    for (const tier of LEVEL_TIERS) {
        if (levelNumber >= tier.minLevel && levelNumber <= tier.maxLevel) {
            const range = tier.maxLevel - tier.minLevel;
            const progress = range > 0 ? (levelNumber - tier.minLevel) / range : 0;
            const lerpInt = (a: number, b: number) => Math.round(a + (b - a) * progress);
            return {
                gridSize: tier.gridSize,
                beaconsPerUnit: tier.beaconsPerUnit,
                difficulty: tier.difficulty,
                difficultyValue: lerpInt(tier.difficultyRange[0], tier.difficultyRange[1]),
            };
        }
    }
    return null;
}

function generateInitialSolution(n: number, b: number, rand: () => number): boolean[][] | null {
    const colCounts = new Int32Array(n);
    const patterns: number[][] = [];
    
    function genPatterns(start: number, current: number[]) {
        if (current.length === b) {
            patterns.push([...current]);
            return;
        }
        for (let c = start; c < n; c++) {
            current.push(c);
            genPatterns(c + 2, current);
            current.pop();
        }
    }
    genPatterns(0, []);
    
    const board = Array.from({ length: n }, () => new Array(n).fill(false));
    let found = false;
    
    function backtrack(r: number, prevPattern: number[]) {
        if (found) return;
        if (r === n) {
            found = true;
            return;
        }
        
        const shuffledPatterns = [...patterns];
        for (let i = shuffledPatterns.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffledPatterns[i], shuffledPatterns[j]] = [shuffledPatterns[j], shuffledPatterns[i]];
        }
        
        for (const pattern of shuffledPatterns) {
            let adjacent = false;
            for (const c of pattern) {
                for (const pc of prevPattern) {
                    if (Math.abs(c - pc) <= 1) {
                        adjacent = true;
                        break;
                    }
                }
                if (adjacent) break;
            }
            if (adjacent) continue;
            
            let canPlace = true;
            for (const c of pattern) {
                if (colCounts[c] >= b) {
                    canPlace = false;
                    break;
                }
            }
            if (!canPlace) continue;
            
            for (const c of pattern) colCounts[c]++;
            
            let forwardCheckPassed = true;
            const remainingRows = n - r - 1;
            for (let c = 0; c < n; c++) {
                if (b - colCounts[c] > remainingRows) {
                    forwardCheckPassed = false;
                    break;
                }
            }
            
            if (forwardCheckPassed) {
                for (const c of pattern) board[r][c] = true;
                backtrack(r + 1, pattern);
                if (found) return;
                for (const c of pattern) board[r][c] = false;
            }
            for (const c of pattern) colCounts[c]--;
        }
    }
    backtrack(0, []);
    return found ? board : null;
}

function generateRegionsFromSolution(n: number, b: number, solution: boolean[][], rand: () => number): number[][] | null {
    const totalCells = n * n;
    
    for (let attempt = 0; attempt < 50; attempt++) {
        const parent = new Int32Array(totalCells);
        const beaconCount = new Int32Array(totalCells);
        
        for (let i = 0; i < totalCells; i++) {
            parent[i] = i;
            const r = Math.floor(i / n);
            const c = i % n;
            beaconCount[i] = solution[r][c] ? 1 : 0;
        }

        const find = (i: number): number => {
            let root = i;
            while (root !== parent[root]) root = parent[root];
            let curr = i;
            while (curr !== root) {
                const nxt = parent[curr];
                parent[curr] = root;
                curr = nxt;
            }
            return root;
        };

        const merge = (i: number, j: number): boolean => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) {
                parent[rootJ] = rootI;
                beaconCount[rootI] += beaconCount[rootJ];
                return true;
            }
            return false;
        };
        
        const edges: { u: number, v: number }[] = [];
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const u = r * n + c;
                if (c < n - 1) edges.push({ u, v: u + 1 });
                if (r < n - 1) edges.push({ u, v: u + n });
            }
        }
        
        const shuffleEdges = () => {
            for (let i = edges.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                const temp = edges[i];
                edges[i] = edges[j];
                edges[j] = temp;
            }
        };

        shuffleEdges();
        for (const edge of edges) {
            const rootU = find(edge.u);
            const rootV = find(edge.v);
            if (rootU !== rootV && beaconCount[rootU] + beaconCount[rootV] <= b) {
                merge(rootU, rootV);
            }
        }
        
        shuffleEdges();
        let changed = true;
        while (changed) {
            changed = false;
            for (const edge of edges) {
                const rootU = find(edge.u);
                const rootV = find(edge.v);
                if (rootU !== rootV && (beaconCount[rootU] === 0 || beaconCount[rootV] === 0)) {
                    merge(rootU, rootV);
                    changed = true;
                }
            }
        }
        
        let success = true;
        let setsCount = 0;
        for (let i = 0; i < totalCells; i++) {
            if (parent[i] === i) {
                if (beaconCount[i] !== b) {
                    success = false;
                    break;
                }
                setsCount++;
            }
        }
        
        if (success && setsCount === n) {
            const rootToRegion = new Map<number, number>();
            let nextId = 0;
            const regionGrid: number[][] = [];
            for (let r = 0; r < n; r++) {
                regionGrid[r] = [];
                for (let c = 0; c < n; c++) {
                    const root = find(r * n + c);
                    if (!rootToRegion.has(root)) {
                        rootToRegion.set(root, nextId++);
                    }
                    regionGrid[r][c] = rootToRegion.get(root)!;
                }
            }
            return regionGrid;
        }
    }
    return null;
}

function countSolutionsFast(n: number, b: number, regions: number[][]): number {
    const colCounts = new Int32Array(n);
    const regionCounts = new Int32Array(n);
    const patterns: number[][] = [];
    
    function genPatterns(start: number, current: number[]) {
        if (current.length === b) {
            patterns.push([...current]);
            return;
        }
        for (let c = start; c < n; c++) {
            current.push(c);
            genPatterns(c + 2, current);
            current.pop();
        }
    }
    genPatterns(0, []);
    
    let solutions = 0;
    
    function backtrack(r: number, prevPattern: number[]) {
        if (solutions > 1) return;
        if (r === n) {
            solutions++;
            return;
        }
        
        for (const pattern of patterns) {
            let adjacent = false;
            for (const c of pattern) {
                for (const pc of prevPattern) {
                    if (Math.abs(c - pc) <= 1) {
                        adjacent = true;
                        break;
                    }
                }
                if (adjacent) break;
            }
            if (adjacent) continue;
            
            let canPlace = true;
            for (const c of pattern) {
                if (colCounts[c] >= b || regionCounts[regions[r][c]] >= b) {
                    canPlace = false;
                    break;
                }
            }
            if (!canPlace) continue;
            
            for (const c of pattern) {
                colCounts[c]++;
                regionCounts[regions[r][c]]++;
            }
            
            let forwardCheckPassed = true;
            const remainingRows = n - r - 1;
            for (let c = 0; c < n; c++) {
                if (b - colCounts[c] > remainingRows) {
                    forwardCheckPassed = false;
                    break;
                }
            }
            
            if (forwardCheckPassed) {
                backtrack(r + 1, pattern);
            }
            
            for (const c of pattern) {
                colCounts[c]--;
                regionCounts[regions[r][c]]--;
            }
        }
    }
    
    backtrack(0, []);
    return solutions;
}

function colorRegions(n: number, regions: number[][]): number[] {
    const adj = Array.from({ length: n }, () => new Set<number>());
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const myRegion = regions[r][c];
            if (r < n - 1) {
                const bottomRegion = regions[r + 1][c];
                if (myRegion !== bottomRegion) {
                    adj[myRegion].add(bottomRegion);
                    adj[bottomRegion].add(myRegion);
                }
            }
            if (c < n - 1) {
                const rightRegion = regions[r][c + 1];
                if (myRegion !== rightRegion) {
                    adj[myRegion].add(rightRegion);
                    adj[rightRegion].add(myRegion);
                }
            }
        }
    }
    
    const colors = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
        const usedColors = new Set<number>();
        for (const neighbor of adj[i]) {
            if (colors[neighbor] !== -1) {
                usedColors.add(colors[neighbor]);
            }
        }
        for (let c = 0; c < 8; c++) {
            if (!usedColors.has(c)) {
                colors[i] = c;
                break;
            }
        }
    }
    return colors;
}

export function generateLevel(levelNumber: number, rand: () => number): StarBattleLevel | null {
    const config = getTierConfig(levelNumber);
    if (!config) return null;

    const { gridSize, beaconsPerUnit, difficulty, difficultyValue } = config;

    for (let i = 0; i < 200; i++) {
        const solution = generateInitialSolution(gridSize, beaconsPerUnit, rand);
        if (!solution) continue;

        const regions = generateRegionsFromSolution(gridSize, beaconsPerUnit, solution, rand);
        if (!regions) continue;

        const solutionsCount = countSolutionsFast(gridSize, beaconsPerUnit, regions);
        if (solutionsCount === 1) {
            const regionColors = colorRegions(gridSize, regions);
            return {
                levelNumber,
                gridSize,
                beaconsPerUnit,
                difficulty,
                difficultyValue,
                regions,
                solution,
                regionColors,
            };
        }
    }
    return null;
}

export function generateLevels(startFrom: number, count: number): StarBattleLevel[] {
    const levels: StarBattleLevel[] = [];
    for (let i = 0; i < count; i++) {
        const levelNumber = startFrom + i;
        const seed = hashString(`StarBattle-level-${levelNumber}`);
        const rand = createSeededRandom(seed);
        const level = generateLevel(levelNumber, rand);
        if (level) {
            levels.push(level);
        } else {
            // fallback logic (very unlikely unless difficulty is mathematically impossible)
            console.error(`Failed to generate Star Battle level ${levelNumber}`);
        }
    }
    return levels;
}
