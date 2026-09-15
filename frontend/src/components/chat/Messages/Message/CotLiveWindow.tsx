import {
  type AnimationEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { cn } from '@/lib/utils';

import {
  COT_LIVE_ROLL_ANIMATION_NAME,
  COT_LIVE_VISIBLE_LINE_COUNT,
  buildCotLiveRollTrack,
  splitCotLiveLines
} from './cotLiveLines';

interface Props {
  output?: string;
  contentRef?: RefObject<HTMLDivElement>;
}

function readPrefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Compact live CoT viewport: last N lines, smaller type, accelerated roll
 * when the window advances. Motion uses CSS keyframes (no timers).
 */
export default function CotLiveWindow({ output, contentRef }: Props) {
  const nextLines = useMemo(() => splitCotLiveLines(output), [output]);
  const previousLinesRef = useRef<string[]>(nextLines);
  const [trackLines, setTrackLines] = useState(nextLines);
  const [isRolling, setIsRolling] = useState(false);
  const [rollNonce, setRollNonce] = useState(0);
  const [rollLines, setRollLines] = useState(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    readPrefersReducedMotion
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const previousLines = previousLinesRef.current;
    const shouldRoll =
      !prefersReducedMotion &&
      previousLines.length === COT_LIVE_VISIBLE_LINE_COUNT &&
      nextLines.length === COT_LIVE_VISIBLE_LINE_COUNT &&
      previousLines.join('\n') !== nextLines.join('\n');

    if (shouldRoll) {
      const roll = buildCotLiveRollTrack(previousLines, nextLines);
      setTrackLines(roll.track);
      setRollLines(roll.rollLines);
      setIsRolling(true);
      setRollNonce((nonce) => nonce + 1);
    } else {
      setTrackLines(nextLines);
      setIsRolling(false);
    }
    previousLinesRef.current = nextLines;
  }, [nextLines, prefersReducedMotion]);

  if (!trackLines.length) {
    return null;
  }

  const visibleCount = isRolling
    ? COT_LIVE_VISIBLE_LINE_COUNT
    : Math.min(COT_LIVE_VISIBLE_LINE_COUNT, trackLines.length);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.animationName !== COT_LIVE_ROLL_ANIMATION_NAME) {
      return;
    }
    setTrackLines(nextLines);
    setIsRolling(false);
  };

  return (
    <div
      ref={contentRef}
      className={cn('cot-live-window', isRolling && 'is-rolling')}
      style={{
        maxHeight: `calc(${visibleCount} * var(--cot-live-line-height))`
      }}
    >
      <div
        key={rollNonce}
        className={cn('cot-live-track', isRolling && 'is-rolling')}
        style={{
          ['--cot-live-roll-lines' as string]: String(rollLines)
        }}
        onAnimationEnd={handleAnimationEnd}
      >
        {trackLines.map((line, index) => (
          <div className="cot-live-line" key={index}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
