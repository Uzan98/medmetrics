
import { calculateNextReview, FSRS_DEFAULTS } from '../src/lib/srs';

// Mock console.table for better output
const logScenario = (name: string, result: any) => {
    console.log(`\n--- Scenario: ${name} ---`);
    console.log(`Interval: ${result.interval} days`);
    console.log(`Stability: ${result.stability}`);
    console.log(`Difficulty: ${result.difficulty}`);
    console.log(`State: ${result.state}`);
    console.log(`Next Review: ${result.nextReviewDate.toISOString().split('T')[0]}`);
};

async function runTests() {
    console.log("Starting FSRS v6 Verification...\n");
    console.log(`Default Params (Length): ${FSRS_DEFAULTS.w.length}`);

    // Test 1: New Card -> Easy
    // Expected: State should move to Review (2), Stability ~4.5 (if default w3 used), Interval ~4-5 days
    const newCardEasy = calculateNextReview(5, 0, 0, 0, 0, 0.9);
    logScenario("New Card -> Easy (5)", newCardEasy);

    // Test 2: New Card -> Hard
    // Expected: State should move to Learning (1) or Review (2)? In our impl we simplified. 
    // Let's see what happens.
    const newCardHard = calculateNextReview(3, 0, 0, 0, 0, 0.9);
    logScenario("New Card -> Hard (3)", newCardHard);

    // Test 3: New Card -> Fail
    const newCardFail = calculateNextReview(0, 0, 0, 0, 0, 0.9);
    logScenario("New Card -> Fail (0)", newCardFail);

    // Test 4: Review Card (Stable) -> Good
    // Assume 10 days elapsed, previous Stability 10, Difficulty 5.
    const reviewGood = calculateNextReview(5, 10, 5, 2, 10, 0.9); // Note: we mapped 5->Easy(4) in srs.ts, wait. 
    // We treat 3=Hard, 5=Easy. What about "Good"? 
    // In StudyMode, we usually have "Errei", "Difícil", "Fácil". missing "Bom"?
    // If the app only has 3 buttons, then we only test those inputs.
    logScenario("Review (S=10, D=5, t=10) -> Easy (5)", reviewGood);

    // Test 5: Review Card (Stable) -> Hard
    const reviewHard = calculateNextReview(3, 10, 5, 2, 10, 0.9);
    logScenario("Review (S=10, D=5, t=10) -> Hard (3)", reviewHard);

    // Test 6: Review Card (Stable) -> Fail
    const reviewFail = calculateNextReview(0, 10, 5, 2, 10, 0.9);
    logScenario("Review (S=10, D=5, t=10) -> Fail (0)", reviewFail);

    // Test 7: Parameter Validation (Empty params)
    const emptyParams = calculateNextReview(5, 0, 0, 0, 0, 0.9, { w: [] });
    logScenario("Empty Params Fallback", emptyParams);

    // Test 8: Short Term Stability (Learning)
    // Card in Learning (State 1), S=0.5. Rated Hard (3) -> Should increase S slightly but stay low?
    const learningStep = calculateNextReview(3, 0.5, 5, 1, 0.1, 0.9);
    logScenario("Learning (S=0.5) -> Hard (3)", learningStep);
}

runTests();
