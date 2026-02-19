export interface ReviewResult {
    interval: number;
    difficulty: number;
    stability: number;
    state: number;
    nextReviewDate: Date;
}

// FSRS v6.1.1 Default Parameters (w0-w20)
// Source: https://github.com/open-spaced-repetition/fsrs4anki/blob/main/fsrs4anki_scheduler.js
export const FSRS_DEFAULTS = {
    w: [
        0.212, 1.2931, 2.3065, 8.2956,
        6.4133, 0.8334, 3.0194, 0.001,
        1.8722, 0.1666, 0.796, 1.4835,
        0.0614, 0.2629, 1.6483, 0.6014,
        1.8729, 0.5425, 0.0912, 0.0658,
        0.1542
    ],
    request_retention: 0.9
};

const default_w = FSRS_DEFAULTS.w;

// Desired Retention Rate (0.7 - 0.95)
const REQUEST_RETENTION = 0.9;

export class FSRS {
    private p: number[];
    private DECAY: number;
    private FACTOR: number;

    constructor(params?: { w?: number[] }) {
        // Validation: If params are provided but length is incorrect (e.g. old V5 params), fallback to defaults
        if (params?.w && params.w.length === default_w.length) {
            this.p = params.w;
        } else {
            this.p = default_w;
        }

        // DECAY = -w[20]
        this.DECAY = -this.p[20];
        // FACTOR = 0.9 ** (1 / DECAY) - 1
        this.FACTOR = Math.pow(0.9, 1 / this.DECAY) - 1;
    }

    private constrain_difficulty(difficulty: number): number {
        return Math.min(Math.max(Number(difficulty.toFixed(2)), 1), 10);
    }

    private mean_reversion(init: number, current: number): number {
        return this.p[7] * init + (1 - this.p[7]) * current;
    }

    private linear_damping(delta_d: number, old_d: number): number {
        return delta_d * (10 - old_d) / 9;
    }

    init_difficulty(rating: number): number {
        // formula: w4 - e^(w5 * (rating - 1)) + 1
        // rating is 1..4 (Again, Hard, Good, Easy)
        return this.constrain_difficulty(this.p[4] - Math.exp(this.p[5] * (rating - 1)) + 1);
    }

    init_stability(rating: number): number {
        // formula: w[rating-1]
        return Math.max(this.p[rating - 1], 0.1);
    }

    next_difficulty(d: number, rating: number): number {
        const delta_d = -this.p[6] * (rating - 3);
        const next_d = d + this.linear_damping(delta_d, d);
        return this.constrain_difficulty(this.mean_reversion(this.init_difficulty(4), next_d));
    }

    next_recall_stability(d: number, s: number, r: number, rating: number): number {
        const hardPenalty = rating === 2 ? this.p[15] : 1;
        const easyBonus = rating === 4 ? this.p[16] : 1;

        return s * (1 +
            Math.exp(this.p[8]) *
            (11 - d) *
            Math.pow(s, -this.p[9]) *
            (Math.exp((1 - r) * this.p[10]) - 1) *
            hardPenalty *
            easyBonus
        );
    }

    next_forget_stability(d: number, s: number, r: number): number {
        const sMin = s / Math.exp(this.p[17] * this.p[18]);
        const sNew = this.p[11] *
            Math.pow(d, -this.p[12]) *
            (Math.pow(s + 1, this.p[13]) - 1) *
            Math.exp((1 - r) * this.p[14]);

        return Math.min(sNew, sMin);
    }

    next_short_term_stability(s: number, rating: number): number {
        let sinc = Math.exp(this.p[17] * (rating - 3 + this.p[18])) * Math.pow(s, -this.p[19]);
        if (rating >= 3) { // Good or Easy
            sinc = Math.max(sinc, 1);
        }
        return s * sinc;
    }

    retrievability(s: number, t: number): number {
        // Formula: (1 + FACTOR * t / s) ^ DECAY
        return Math.pow(1 + this.FACTOR * t / s, this.DECAY);
    }

    next_interval(s: number, request_retention: number = REQUEST_RETENTION): number {
        const new_ivl = s / this.FACTOR * (Math.pow(request_retention, 1 / this.DECAY) - 1);
        return Math.max(Math.round(new_ivl), 1);
    }
}

/**
 * Main wrapper function for FSRS v6.1.1 review calculation
 */
export function calculateNextReview(
    quality: 0 | 1 | 2 | 3 | 4 | 5,
    lastStability: number = 0,
    lastDifficulty: number = 0,
    lastState: number = 0,
    daysSinceLastReview: number = 0,
    requestRetention: number = 0.9,
    fsrsParams?: { w?: number[] }
): ReviewResult {
    const fsrs = new FSRS(fsrsParams);

    // Map quality to FSRS 1-4
    // 0(Wrong) -> 1(Again)
    // 3(Hard) -> 2(Hard)
    // 5(Easy) -> 4(Easy)
    // Good (implicit) -> 3
    let rating = 3;
    if (quality === 0 || quality === 1) rating = 1;
    else if (quality === 3) rating = 2;
    else if (quality === 5) rating = 4;

    let s = lastStability;
    let d = lastDifficulty;
    let state = lastState; // 0=New, 1=Learning, 2=Review, 3=Relearning

    if (state === 0) {
        // New Card
        d = fsrs.init_difficulty(rating);
        s = fsrs.init_stability(rating);
        state = rating === 1 ? 1 : 2; // Fail -> Learning, else Review (simplification)
    } else if (state === 1 || state === 3) {
        // Learning or Relearning state (Short-term)
        // Note: Full FSRS scheduler uses steps (min, 10min etc).
        // Here we map simpler logic: 
        s = fsrs.next_short_term_stability(s, rating);

        // State transitions
        if (rating === 1) {
            state = 1; // Stay in learning
        } else if (rating === 3 || rating === 4) {
            // If good/easy, graduate to review? 
            // FSRS scheduler graduates if stability is high enough or steps completed.
            // For simplicity, we graduate on 'Easy' or 'Good' if stability > 1 day equivalent?
            // Or just move to state 2.
            state = 2;
            d = fsrs.next_difficulty(d, rating); // Update Difficulty on graduation
        }
    } else {
        // Review State (2)
        const r = fsrs.retrievability(s, daysSinceLastReview);

        if (rating === 1) {
            // Forget
            d = fsrs.next_difficulty(d, rating);
            s = fsrs.next_forget_stability(d, s, r);
            state = 3; // Relearning
        } else {
            // Recall
            d = fsrs.next_difficulty(d, rating);
            s = fsrs.next_recall_stability(d, s, r, rating);
            state = 2;
        }
    }

    // Interval Calculation
    let interval = fsrs.next_interval(s, requestRetention);

    // Clamp Again to 1 day if handling purely in days
    if (rating === 1) {
        interval = 1;
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    nextReviewDate.setHours(0, 0, 0, 0);

    return {
        interval,
        difficulty: parseFloat(d.toFixed(2)),
        stability: parseFloat(s.toFixed(2)),
        state,
        nextReviewDate
    };
}
