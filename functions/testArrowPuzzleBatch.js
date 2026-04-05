const { generateLevels, getDifficultyConfig } = require("./lib/utils/arrowPuzzleGenerator");

console.log("=== Arrow Puzzle v6 — Shaped Grids Test ===\n");

const tiers = [
    { name: "Tutorial  L1-5",     start: 1,   count: 5 },
    { name: "Easy      L6-30",    start: 6,   count: 5 },
    { name: "Medium    L31-100",  start: 41,  count: 5 },
    { name: "Hard      L121-250", start: 121, count: 5 },
    { name: "Expert    L251-400", start: 251, count: 3 },
    { name: "Master    L401-500", start: 401, count: 3 },
];

for (const tier of tiers) {
    const cfg = getDifficultyConfig(tier.start);
    const t0 = Date.now();
    const levels = generateLevels(tier.start, tier.count);
    const elapsed = Date.now() - t0;
    const ok = levels.length;
    if (ok > 0) {
        const l0 = levels[0];
        const avgStr = (levels.reduce((s,l) => s+l.streams.length, 0)/ok).toFixed(1);
        const avgPath = (levels.reduce((s,l) => s+l.streams.reduce((a,st)=>a+st.cells.length,0)/l.streams.length, 0)/ok).toFixed(1);
        const avgActive = (levels.reduce((s,l) => s+l.activeCells.length, 0)/ok).toFixed(0);
        const avgFill = (levels.reduce((s,l) => s+l.streams.reduce((a,st)=>a+st.cells.length,0)/l.activeCells.length, 0)/ok*100).toFixed(0);
        const shapes = [...new Set(levels.map(l=>l.shapeName))].join(", ");
        console.log(`${tier.name}  [${cfg.gridSize}×${cfg.gridSize} bbox]`);
        console.log(`  ${ok}/${tier.count} in ${elapsed}ms | Shapes: ${shapes}`);
        console.log(`  Active: ${avgActive} cells | Streams: ${avgStr} | AvgPath: ${avgPath} | Fill: ${avgFill}% | Sol: ${(levels.reduce((s,l)=>s+l.solution.length,0)/ok).toFixed(1)} steps\n`);
    } else {
        console.log(`${tier.name}: 0/${tier.count} in ${elapsed}ms\n`);
    }
}
