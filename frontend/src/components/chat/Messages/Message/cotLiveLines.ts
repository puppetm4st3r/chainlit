/**
 * Visible live CoT window. Must stay equal to
 * ``LIVE_STEP_VISIBLE_LINE_COUNT`` in ``Dolf.Chainlit.live_step_output``.
 */
export const COT_LIVE_VISIBLE_LINE_COUNT = 3;
/** Must stay equal to ``LIVE_STEP_ROLLING_WINDOW_METADATA_KEY``. */
export const COT_ROLLING_WINDOW_METADATA_KEY = 'cotRollingWindow';
/** Must stay equal to ``LIVE_STEP_LINE_COUNT_METADATA_KEY``. */
export const COT_LIVE_LINE_COUNT_METADATA_KEY = 'cotLineCount';
export const COT_LIVE_ROLL_ANIMATION_NAME = 'cot-live-roll';

type StepLike = {
  metadata?: Record<string, unknown>;
  steps?: Array<{ type?: string }>;
};

export const isCotRollingWindowStep = (message: StepLike): boolean =>
  message.metadata?.[COT_ROLLING_WINDOW_METADATA_KEY] === true;

export const splitCotLiveLines = (output?: string): string[] =>
  String(output || '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-COT_LIVE_VISIBLE_LINE_COUNT);

/**
 * Format the step-title elapsed clock.
 * Under one minute keep `` @ N s.``; then ``mm:ss``; then ``hh:mm:ss``.
 */
export const formatStepElapsedClock = (elapsedSeconds: number): string => {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return '';
  }
  const totalSeconds = Math.round(elapsedSeconds);
  if (totalSeconds < 60) {
    return ` @ ${totalSeconds} s.`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return ` @ ${String(hours).padStart(2, '0')}:${paddedMinutes}:${paddedSeconds}`;
  }
  return ` @ ${paddedMinutes}:${paddedSeconds}`;
};

/**
 * Child-task count shown as ``[n]`` after the elapsed clock.
 * Live CoT uses persisted ``cotLineCount``; other steps use nested non-message children.
 */
export const getStepChildTaskCount = (step: StepLike): number => {
  const metadataCount = step.metadata?.[COT_LIVE_LINE_COUNT_METADATA_KEY];
  if (typeof metadataCount === 'number' && Number.isFinite(metadataCount)) {
    return Math.max(0, Math.floor(metadataCount));
  }
  return (step.steps || []).filter(
    (child) => !String(child.type || '').includes('message')
  ).length;
};

/**
 * Build the ticker track when the visible window advances by one or more
 * lines (batched socket updates or a multiline ``ui_step_update``).
 */
export const buildCotLiveRollTrack = (
  previous: string[],
  next: string[]
): { track: string[]; rollLines: number } => {
  let overlap = 0;
  const maxOverlap = Math.min(previous.length, next.length);
  for (let size = maxOverlap; size >= 0; size -= 1) {
    const previousTail = previous.slice(previous.length - size).join('\n');
    const nextHead = next.slice(0, size).join('\n');
    if (previousTail === nextHead) {
      overlap = size;
      break;
    }
  }
  const incoming = next.slice(overlap);
  return {
    track: [...previous, ...incoming],
    rollLines: incoming.length
  };
};
