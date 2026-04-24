/**
 * Local Neural Link Level Seeder
 * Uses Firebase CLI credentials (no service account needed).
 * Usage: node seedLocally.js <startFrom> <endAt>
 * Example: node seedLocally.js 501 700
 */

const https = require("https");
const fs = require("fs");
const { generateLevel } = require("./functions/lib/utils/neuralLinkGenerator");

const PROJECT_ID = "mini-games-9a4e1";
const COLLECTION = "neuralLinkLevels";

// Read firebase-tools token
function getFirebaseToken() {
    const configPath = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
    try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        return config?.tokens?.access_token || null;
    } catch (e) {
        return null;
    }
}

// Refresh access token using refresh_token
async function refreshToken() {
    const configPath = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const refreshToken = config?.tokens?.refresh_token;
    if (!refreshToken) throw new Error("No refresh token found. Run: firebase login");

    return new Promise((resolve, reject) => {
        const postData = `client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8vu5T6Io0Ih5xJsQ1&refresh_token=${refreshToken}&grant_type=refresh_token`;
        const options = {
            hostname: "oauth2.googleapis.com",
            path: "/token",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
            },
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                const parsed = JSON.parse(data);
                if (parsed.access_token) {
                    // Update stored token
                    config.tokens.access_token = parsed.access_token;
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    resolve(parsed.access_token);
                } else {
                    reject(new Error(`Token refresh failed: ${data}`));
                }
            });
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}

// Firestore REST API - batch write (up to 500 operations per batch)
async function firestoreBatchWrite(token, writes) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ writes });
        const options = {
            hostname: "firestore.googleapis.com",
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Firestore error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

function levelToFirestoreWrite(level) {
    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/level_${level.levelNumber}`;
    return {
        update: {
            name: docPath,
            fields: {
                levelNumber: { integerValue: level.levelNumber },
                gridSize: { integerValue: level.gridSize },
                flowCount: { integerValue: level.flowCount },
                deadNeuronCount: { integerValue: level.deadNeuronCount },
                difficulty: { stringValue: level.difficulty },
                difficultyValue: { integerValue: level.difficultyValue },
                endpointsJson: { stringValue: JSON.stringify(level.endpoints) },
                deadCellsJson: { stringValue: JSON.stringify(level.deadCells) },
                solutionJson: { stringValue: JSON.stringify(level.solution) },
            },
        },
    };
}

const startFrom = parseInt(process.argv[2]) || 501;
const endAt = parseInt(process.argv[3]) || 1000;

async function seed() {
    console.log(`\n🧠 Neural Link Local Seeder`);
    console.log(`📦 Seeding levels ${startFrom} → ${endAt}\n`);

    let token = getFirebaseToken();
    if (!token) {
        console.log("🔄 Refreshing token...");
        token = await refreshToken();
    }

    let writes = [];
    let totalSeeded = 0;
    const failedLevels = [];
    const startTime = Date.now();

    for (let lvl = startFrom; lvl <= endAt; lvl++) {
        let level = null;
        for (let attempt = 0; attempt < 15; attempt++) {
            level = generateLevel(lvl);
            if (level) break;
        }

        if (!level) {
            failedLevels.push(lvl);
            process.stdout.write(`\n  ⚠️  Skipped level ${lvl}\n`);
            continue;
        }

        writes.push(levelToFirestoreWrite(level));
        totalSeeded++;

        // Commit in batches of 400
        if (writes.length >= 400) {
            try {
                token = await refreshToken(); // keep token fresh
            } catch (e) { /* use existing */ }
            await firestoreBatchWrite(token, writes);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n  ✅ Committed batch — ${totalSeeded} levels done (${elapsed}s)`);
            writes = [];
        }

        if (lvl % 5 === 0) {
            const pct = (((lvl - startFrom + 1) / (endAt - startFrom + 1)) * 100).toFixed(1);
            process.stdout.write(`\r  📊 ${pct}% — level ${lvl}/${endAt}`);
        }
    }

    // Final batch
    if (writes.length > 0) {
        try { token = await refreshToken(); } catch (e) {}
        await firestoreBatchWrite(token, writes);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✨ Done! Seeded ${totalSeeded} levels in ${elapsed}s`);
    if (failedLevels.length > 0) {
        console.log(`⚠️  Failed: ${failedLevels.join(", ")}`);
    }
}

seed().catch((err) => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
});
