export interface ReviewResult {
    interval: number;
    easeFactor: number;
    nextReviewDate: Date;
}

/**
 * Calculates the next review date using a modified SuperMemo-2 (SM-2) algorithm.
 * 
 * @param quality - The quality of the review (0-5). 
 *                  0-2: Fail (Wrong)
 *                  3: Pass (Hard)
 *                  4: Pass (Good/Medium)
 *                  5: Pass (Easy)
 * @param previousInterval - The previous interval in days (default: 0 for new cards)
 * @param previousEaseFactor - The previous ease factor (default: 2.5)
 * @returns ReviewResult object containing the new interval, ease factor, and next review date.
 */
export function calculateNextReview(
    quality: 0 | 1 | 2 | 3 | 4 | 5,
    previousInterval: number,
    previousEaseFactor: number,
    lastReviewDate: Date = new Date()
): ReviewResult {
    let interval: number;
    let easeFactor: number;

    // Quality < 3 means the user forgot the card. 
    // In strict SM-2, this resets interval to 1.
    if (quality < 3) {
        interval = 1;
        easeFactor = previousEaseFactor; // EF doesn't change on fail in standard SM-2, but we can lower it slightly if desired. SM-2 says keep it.
        // Some variations lower EF on fail. Let's stick to standard SM-2 for now where EF is updated only on pass, 
        // BUT wait, SM-2 formula actually updates EF for every repetition based on q.
        // Let's use the standard formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    } else {
        // Correct response
        if (previousInterval === 0) {
            interval = 1;
        } else if (previousInterval === 1) {
            interval = 6;
        } else {
            interval = Math.round(previousInterval * previousEaseFactor);
        }

        // Calculate new Ease Factor
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    }

    // If quality was < 3, the SM-2 algorithm actually suggests resetting interval to 1, 
    // AND updating EF. Let's apply the EF update for all cases to capture difficulty drift.
    // However, for Simplicity in this app context:
    // "Wrong" (0) -> Reset interval to 1. EF penalty?
    // "Hard" (3) -> Pass, but difficult.
    // "Easy" (5) -> Pass, easy.

    // Let's refine the logic to match our 3 buttons: Wrong (0), Hard (3), Easy (5).
    // We map:
    // Wrong -> 0
    // Hard -> 3
    // Easy -> 5

    // Recalculate based on these inputs using the standard formula:
    easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3; // Minimum EF threshold

    if (quality < 3) {
        interval = 1; // Reset on fail
    }

    const nextReviewDate = new Date(lastReviewDate);
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    // Normalize to midnight to avoid time creep
    nextReviewDate.setHours(0, 0, 0, 0);

    return {
        interval,
        easeFactor,
        nextReviewDate
    };
}
