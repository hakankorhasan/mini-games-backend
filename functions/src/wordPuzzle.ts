import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getLevelInfo, TOTAL_LEVELS } from "./data/wordPuzzleData";

/**
 * getWordPuzzleLevel
 *
 * HTTP GET endpoint — returns level info and assigns a random word.
 * If the user already has a session for this level, returns that session.
 * Otherwise picks a random word from the pool and creates a new session.
 *
 * GET /getWordPuzzleLevel?level=42&deviceId=xxx
 * → { level: { levelNumber, wordLength, difficulty, maxGuesses },
 *     session: { guesses, attemptsUsed, solved, failed } }
 */
export const getWordPuzzleLevel = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "GET") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use GET.",
            });
            return;
        }

        try {
            const levelParam = req.query.level;
            const deviceId = req.query.deviceId as string;

            if (!levelParam) {
                res.status(400).json({
                    success: false,
                    error: "level query parameter is required.",
                });
                return;
            }

            if (!deviceId) {
                res.status(400).json({
                    success: false,
                    error: "deviceId query parameter is required.",
                });
                return;
            }

            const levelNumber = parseInt(String(levelParam), 10);
            if (isNaN(levelNumber) || levelNumber < 1) {
                res.status(400).json({
                    success: false,
                    error: "level must be a positive integer.",
                });
                return;
            }

            if (levelNumber > TOTAL_LEVELS) {
                res.status(400).json({
                    success: false,
                    error: `Max level is ${TOTAL_LEVELS}.`,
                });
                return;
            }

            const levelInfo = getLevelInfo(levelNumber);
            if (!levelInfo) {
                res.status(404).json({
                    success: false,
                    error: `Level ${levelNumber} not found.`,
                });
                return;
            }

            const db = admin.firestore();
            const sessionId = `${deviceId}_level_${levelNumber}`;
            const sessionRef = db
                .collection("wordPuzzleSessions")
                .doc(sessionId);
            const sessionDoc = await sessionRef.get();

            // If session exists, return it (user is continuing)
            if (sessionDoc.exists) {
                const session = sessionDoc.data()!;
                res.status(200).json({
                    success: true,
                    level: {
                        levelNumber,
                        wordLength: levelInfo.wordLength,
                        difficulty: levelInfo.difficulty,
                        maxGuesses: 5,
                    },
                    session: {
                        guesses: session.guesses || [],
                        attemptsUsed: session.attemptsUsed || 0,
                        solved: session.solved || false,
                        failed: session.failed || false,
                    },
                });
                return;
            }

            // No session — pick a random word and create session
            const poolDoc = await db
                .collection("wordPool")
                .doc(`length_${levelInfo.wordLength}`)
                .get();

            if (!poolDoc.exists) {
                res.status(500).json({
                    success: false,
                    error: `No word pool for ${levelInfo.wordLength}-letter words. Run seedWordPuzzleLevels first.`,
                });
                return;
            }

            const words: string[] = poolDoc.data()!.words;
            const randomWord = words[Math.floor(Math.random() * words.length)];

            // Create session with assigned word
            await sessionRef.set({
                deviceId,
                levelNumber,
                word: randomWord,
                wordLength: levelInfo.wordLength,
                guesses: [],
                attemptsUsed: 0,
                solved: false,
                failed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            res.status(200).json({
                success: true,
                level: {
                    levelNumber,
                    wordLength: levelInfo.wordLength,
                    difficulty: levelInfo.difficulty,
                    maxGuesses: 5,
                },
                session: {
                    guesses: [],
                    attemptsUsed: 0,
                    solved: false,
                    failed: false,
                },
            });
        } catch (error) {
            functions.logger.error("getWordPuzzleLevel error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);

/**
 * checkWordPuzzleGuess
 *
 * HTTP POST endpoint — validates a guess against the session's word.
 *
 * POST /checkWordPuzzleGuess
 * Body: { deviceId, levelNumber, guess }
 *
 * Returns:
 * {
 *   result: [
 *     { letter: "K", status: "correct" },   // yeşil — doğru yerde
 *     { letter: "A", status: "present" },    // sarı  — kelimede var ama yanlış yerde
 *     { letter: "X", status: "absent" }      // siyah — kelimede yok
 *   ],
 *   attemptsUsed, maxAttempts, solved, failed,
 *   answer? (only when solved or failed)
 * }
 */
export const checkWordPuzzleGuess = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST.",
            });
            return;
        }

        try {
            const { deviceId, levelNumber, guess } = req.body;

            if (!deviceId || typeof deviceId !== "string") {
                res.status(400).json({
                    success: false,
                    error: "deviceId is required.",
                });
                return;
            }
            if (
                typeof levelNumber !== "number" ||
                levelNumber < 1 ||
                !Number.isInteger(levelNumber)
            ) {
                res.status(400).json({
                    success: false,
                    error: "levelNumber must be a positive integer.",
                });
                return;
            }
            if (!guess || typeof guess !== "string") {
                res.status(400).json({
                    success: false,
                    error: "guess is required.",
                });
                return;
            }

            const db = admin.firestore();
            const sessionId = `${deviceId}_level_${levelNumber}`;
            const sessionRef = db
                .collection("wordPuzzleSessions")
                .doc(sessionId);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                res.status(400).json({
                    success: false,
                    error: "No active session. Call getWordPuzzleLevel first.",
                });
                return;
            }

            const session = sessionDoc.data()!;
            const answer = (session.word as string).toUpperCase();
            const maxGuesses = 5;
            const upperGuess = guess.toUpperCase();

            // Already solved?
            if (session.solved) {
                res.status(400).json({
                    success: false,
                    error: "Bu level zaten çözüldü!",
                    solved: true,
                });
                return;
            }

            // Out of attempts?
            if (session.attemptsUsed >= maxGuesses) {
                res.status(400).json({
                    success: false,
                    error: "Tahmin hakkınız kalmadı!",
                    failed: true,
                    answer,
                });
                return;
            }

            // Validate guess length
            if (upperGuess.length !== answer.length) {
                res.status(400).json({
                    success: false,
                    error: `Guess must be ${answer.length} letters.`,
                });
                return;
            }

            // Evaluate the guess (Wordle algorithm)
            const result = evaluateGuess(upperGuess, answer);

            const solved = upperGuess === answer;
            const attemptsUsed = (session.attemptsUsed || 0) + 1;
            const failed = !solved && attemptsUsed >= maxGuesses;

            const guesses = session.guesses || [];
            guesses.push({ guess: upperGuess, result });

            // Update session
            await sessionRef.update({
                guesses,
                attemptsUsed,
                solved,
                failed,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const response: Record<string, unknown> = {
                success: true,
                result,
                attemptsUsed,
                maxAttempts: maxGuesses,
                solved,
                failed,
            };

            if (solved || failed) {
                response.answer = answer;
            }

            res.status(200).json(response);
        } catch (error) {
            functions.logger.error("checkWordPuzzleGuess error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);

/**
 * resetWordPuzzleSession
 *
 * HTTP POST endpoint — resets a level session (new random word assigned).
 *
 * POST /resetWordPuzzleSession
 * Body: { deviceId, levelNumber }
 */
export const resetWordPuzzleSession = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST.",
            });
            return;
        }

        try {
            const { deviceId, levelNumber } = req.body;

            if (!deviceId || typeof deviceId !== "string") {
                res.status(400).json({
                    success: false,
                    error: "deviceId is required.",
                });
                return;
            }
            if (
                typeof levelNumber !== "number" ||
                levelNumber < 1 ||
                !Number.isInteger(levelNumber)
            ) {
                res.status(400).json({
                    success: false,
                    error: "levelNumber must be a positive integer.",
                });
                return;
            }

            const db = admin.firestore();
            const sessionRef = db
                .collection("wordPuzzleSessions")
                .doc(`${deviceId}_level_${levelNumber}`);

            await sessionRef.delete();

            res.status(200).json({
                success: true,
                message: `Session for level ${levelNumber} reset. Call getWordPuzzleLevel to get a new word.`,
            });
        } catch (error) {
            functions.logger.error("resetWordPuzzleSession error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);

/**
 * getWordPuzzleHint
 *
 * HTTP POST endpoint — reveals one correct letter at an unrevealed position.
 *
 * POST /getWordPuzzleHint
 * Body: { deviceId, levelNumber, revealedPositions: [0, 2] }
 *
 * Hint limits:
 *   3-6 letter words → 1 hint
 *   7-8 letter words → 2 hints
 *
 * Returns:
 * { success: true, letter: "A", position: 1 }
 */
export const getWordPuzzleHint = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST.",
            });
            return;
        }

        try {
            const { deviceId, levelNumber, revealedPositions } = req.body;

            if (!deviceId || typeof deviceId !== "string") {
                res.status(400).json({
                    success: false,
                    error: "deviceId is required.",
                });
                return;
            }
            if (
                typeof levelNumber !== "number" ||
                levelNumber < 1 ||
                !Number.isInteger(levelNumber)
            ) {
                res.status(400).json({
                    success: false,
                    error: "levelNumber must be a positive integer.",
                });
                return;
            }

            const revealed: number[] = Array.isArray(revealedPositions)
                ? revealedPositions
                : [];

            const db = admin.firestore();
            const sessionId = `${deviceId}_level_${levelNumber}`;
            const sessionRef = db
                .collection("wordPuzzleSessions")
                .doc(sessionId);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                res.status(400).json({
                    success: false,
                    error: "No active session. Call getWordPuzzleLevel first.",
                });
                return;
            }

            const session = sessionDoc.data()!;
            const word = (session.word as string).toUpperCase();
            const wordLength = word.length;

            // Already solved or failed
            if (session.solved) {
                res.status(400).json({
                    success: false,
                    error: "Bu level zaten çözüldü!",
                });
                return;
            }
            if (session.failed) {
                res.status(400).json({
                    success: false,
                    error: "Bu level kaybedildi!",
                });
                return;
            }

            // Check hint limit
            const maxHints = wordLength >= 7 ? 2 : 1;
            const hintsUsed = session.hintsUsed || 0;

            if (hintsUsed >= maxHints) {
                res.status(400).json({
                    success: false,
                    error: `Bu level için maksimum ${maxHints} ipucu hakkınız var ve tamamını kullandınız.`,
                });
                return;
            }

            // Find unrevealed positions
            const availablePositions: number[] = [];
            for (let i = 0; i < wordLength; i++) {
                if (!revealed.includes(i)) {
                    availablePositions.push(i);
                }
            }

            if (availablePositions.length === 0) {
                res.status(400).json({
                    success: false,
                    error: "Tüm harfler zaten açık!",
                });
                return;
            }

            // Pick random unrevealed position
            const randomIndex = Math.floor(
                Math.random() * availablePositions.length
            );
            const position = availablePositions[randomIndex];
            const letter = word[position];

            // Update hints used in session
            await sessionRef.update({
                hintsUsed: hintsUsed + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            res.status(200).json({
                success: true,
                letter,
                position,
                hintsUsed: hintsUsed + 1,
                maxHints,
            });
        } catch (error) {
            functions.logger.error("getWordPuzzleHint error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);

// ──────────────────────────────────────────────────
//  Wordle-style guess evaluation
//  Two-pass algorithm handles duplicate letters correctly.
// ──────────────────────────────────────────────────

interface LetterResult {
    letter: string;
    status: "correct" | "present" | "absent";
}

function evaluateGuess(guess: string, answer: string): LetterResult[] {
    const result: LetterResult[] = Array.from(guess, (letter) => ({
        letter,
        status: "absent" as const,
    }));

    const answerChars = answer.split("");
    const used = new Array(answer.length).fill(false);

    // Pass 1: correct positions (green)
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === answerChars[i]) {
            result[i].status = "correct";
            used[i] = true;
        }
    }

    // Pass 2: present but wrong position (yellow)
    for (let i = 0; i < guess.length; i++) {
        if (result[i].status === "correct") continue;
        for (let j = 0; j < answerChars.length; j++) {
            if (!used[j] && guess[i] === answerChars[j]) {
                result[i].status = "present";
                used[j] = true;
                break;
            }
        }
    }

    return result;
}
