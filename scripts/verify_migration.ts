
import { calculateNextReview } from '../src/lib/srs';

const logScenario = (name: string, result: any) => {
    console.log(`\n--- Scenario: ${name} ---`);
    console.log(`Interval: ${result.interval} days`);
    console.log(`Stability: ${result.stability}`);
    console.log(`Difficulty: ${result.difficulty}`);
    console.log(`State: ${result.state}`);
    console.log(`Next Review: ${result.nextReviewDate.toISOString().split('T')[0]}`);
};

async function runMigrationTests() {
    console.log("Starting Migration Logic Verification...\n");

    // Mock Legacy Card
    // Interval: 50 days (User knows it well)
    // S: null, D: null, State: null
    const legacyCard = {
        interval: 50,
        stability: null,
        difficulty: null,
        state: null,
        last_reviewed_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString() // 50 days ago
    };

    const daysSince = 50; // exact match for simplicity

    // 1. Current Bad Behavior (Treat as New)
    // S=0, D=0, State=0
    const resultBad = calculateNextReview(
        5, // Easy
        0, 0, 0,
        daysSince
    );
    // Expected: interval ~4 days (Reset!)
    logScenario("Legacy Card Treated as New (BAD)", resultBad);


    // 2. Proposed Migration Logic
    // S = Interval (50)
    // D = 5 (Default medium difficulty)
    // State = 2 (Review)

    const effectiveS = legacyCard.stability || legacyCard.interval || 0;
    const effectiveD = legacyCard.difficulty || (legacyCard.interval > 0 ? 5 : 0);
    const effectiveState = legacyCard.state ?? (legacyCard.interval > 0 ? 2 : 0);

    console.log(`\nEffective Params: S=${effectiveS}, D=${effectiveD}, State=${effectiveState}`);

    const resultGood = calculateNextReview(
        5, // Easy
        effectiveS, effectiveD, effectiveState,
        daysSince
    );
    // Expected: Interval > 50 (e.g., 70-100)
    logScenario("Legacy Card with Migration Logic (GOOD)", resultGood);
}

runMigrationTests();
