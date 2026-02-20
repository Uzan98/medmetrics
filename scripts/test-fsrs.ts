import { calculateNextReview, ReviewResult } from '../src/lib/srs';

function runSequence(sequence: (1 | 3 | 4 | 5)[], name: string) {
    console.log(`\n--- Sequence: ${name} ---`);
    let state = 0;
    let s = 0;
    let d = 0;
    let daysSince = 0;

    for (let i = 0; i < sequence.length; i++) {
        const quality = sequence[i];
        const res = calculateNextReview(quality, s, d, state, daysSince);
        console.log(`Review ${i + 1} (Quality ${quality}):`);
        console.log(`  Interval:    ${res.interval} days`);
        console.log(`  State:       ${res.state}`);
        console.log(`  Stability:   ${res.stability.toFixed(2)}`);
        console.log(`  Difficulty:  ${res.difficulty.toFixed(2)}`);

        s = res.stability;
        d = res.difficulty;
        state = res.state;
        daysSince = res.interval;
    }
}

runSequence([4, 4, 1, 4, 4, 4], "Good, Good, Lapse, Good, Good, Good");
