// Gold is earned from verified Conquest waves, not Illusion Training.
// One recorded victory per run and wave makes progress retries idempotent.
export const GOLD_PER_WAVE = 10;
export const goldFromWins = (wins: number): number => wins * GOLD_PER_WAVE;
