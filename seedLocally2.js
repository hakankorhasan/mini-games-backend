/**
 * Local Neural Link Level Seeder v2
 * Uses firebase-admin with credential from firebase-tools refresh_token
 * Usage: node seedLocally2.js <startFrom> <endAt>
 */

const https = require("https");
const fs = require("fs");

const { generateLevel } = require("./functions/lib/utils/neuralLinkGenerator");

const PROJECT_ID = "mini-games-9a4e1";
const COLLECTION = "neuralLinkLevels";
const configPath = `${process.env.HOME}/.config/configstore/firebase-tools.json`;

// Get access token - use existing if valid, otherwise error
async function getAccessToken() {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const token = config?.tokens?.access_token;
    const expiresAt = config?.tokens?.expires_at;
    
    if (token && expiresAt && Date.now() < expiresAt - 60000) {
        return token;
    }
    
    // Token expired — user needs to run: firebase login
    throw new Error("Firebase token expired. Please run: firebase login");
}

// Use Firestore REST API v1beta1 which supports OAuth2 tokens from firebase-tools
async function firestoreImport(token, levelDocs) {
    // Use individual set operations via REST, batching in groups of 20
    const batchSize = 20;
    for (let i = 0; i < levelDocs.length; i += batchSize) {
        const batch = levelDocs.slice(i, i + batchSize);
        await Promise.all(batch.map(doc => firestoreSet(token, doc.id, doc.fields)));
    }
}

async function firestoreSet(token, docId, fields) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ fields });
        const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${docId}`;
        const options = {
            hostname: "firestore.googleapis.com",
            path,
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error(`Firestore PATCH ${docId} failed ${res.statusCode}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

function toFirestoreFields(level) {
    return {
        levelNumber: { integerValue: `${level.levelNumber}` },
        gridSize: { integerValue: `${level.gridSize}` },
        flowCount: { integerValue: `${level.flowCount}` },
        deadNeuronCount: { integerValue: `${level.deadNeuronCount}` },
        difficulty: { stringValue: level.difficulty },
        difficultyValue: { integerValue: `${level.difficultyValue}` },
        endpointsJson: { stringValue: JSON.stringify(level.endpoints) },
        deadCellsJson: { stringValue: JSON.stringify(level.deadCells) },
        solutionJson: { stringValue: JSON.stringify(level.solution) },
    };
}

const startFrom = parseInt(process.argv[2]) || 501;
const endAt = parseInt(process.argv[3]) || 1000;
const WRITE_BATCH = 50; // Write 50 at a time, refresh token every 200

async function seed() {
    console.log(`\n🧠 Neural Link Seeder v2`);
    console.log(`📦 Levels ${startFrom} → ${endAt}\n`);

    let token = await getAccessToken();
    let totalSeeded = 0;
    const failedLevels = [];
    const startTime = Date.now();
    let pendingDocs = [];
    let sinceLastRefresh = 0;

    for (let lvl = startFrom; lvl <= endAt; lvl++) {
        let level = null;
        for (let attempt = 0; attempt < 15; attempt++) {
            level = generateLevel(lvl);
            if (level) break;
        }

        if (!level) {
            failedLevels.push(lvl);
            continue;
        }

        pendingDocs.push({
            id: `level_${lvl}`,
            fields: toFirestoreFields(level),
        });
        totalSeeded++;
        sinceLastRefresh++;

        // Write in batches
        if (pendingDocs.length >= WRITE_BATCH) {
            // Refresh token every 200 levels
            if (sinceLastRefresh >= 200) {
                token = await getAccessToken();
                sinceLastRefresh = 0;
            }
            await firestoreImport(token, pendingDocs);
            pendingDocs = [];
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const pct = (((lvl - startFrom + 1) / (endAt - startFrom + 1)) * 100).toFixed(1);
            process.stdout.write(`\r  📊 ${pct}% — level ${lvl}/${endAt} (${totalSeeded} written, ${elapsed}s)`);
        }
    }

    // Final batch
    if (pendingDocs.length > 0) {
        token = await getAccessToken();
        await firestoreImport(token, pendingDocs);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✨ Done! Seeded ${totalSeeded} levels in ${elapsed}s`);
    if (failedLevels.length > 0) {
        console.log(`⚠️  Skipped ${failedLevels.length} levels: ${failedLevels.slice(0, 20).join(", ")}${failedLevels.length > 20 ? '...' : ''}`);
    }
}

seed().catch((err) => {
    console.error("\n❌ Fatal:", err.message);
    process.exit(1);
});
