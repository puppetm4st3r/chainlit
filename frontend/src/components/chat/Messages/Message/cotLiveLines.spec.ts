import { describe, expect, it } from 'vitest';

import {
  COT_LIVE_LINE_COUNT_METADATA_KEY,
  COT_LIVE_VISIBLE_LINE_COUNT,
  COT_ROLLING_WINDOW_METADATA_KEY,
  buildCotLiveRollTrack,
  formatStepElapsedClock,
  getStepChildTaskCount,
  isCotRollingWindowStep,
  splitCotLiveLines
} from './cotLiveLines';

describe('splitCotLiveLines', () => {
  it('keeps the last three non-empty lines without trimming their text', () => {
    expect(splitCotLiveLines('a\n\nb\nc\nd\ne\n  f  ')).toEqual([
      'd',
      'e',
      '  f  '
    ]);
    expect(splitCotLiveLines('a\n\nb\nc\nd\ne\n  f  ')).toHaveLength(
      COT_LIVE_VISIBLE_LINE_COUNT
    );
  });

  it('returns an empty list for blank output', () => {
    expect(splitCotLiveLines('')).toEqual([]);
    expect(splitCotLiveLines(' \n \n')).toEqual([]);
  });
});

describe('buildCotLiveRollTrack', () => {
  it('rolls one line when the window advances by one', () => {
    expect(
      buildCotLiveRollTrack(['a', 'b', 'c'], ['b', 'c', 'd'])
    ).toEqual({
      track: ['a', 'b', 'c', 'd'],
      rollLines: 1
    });
  });

  it('rolls several lines when the window jumps', () => {
    expect(
      buildCotLiveRollTrack(['a', 'b', 'c'], ['c', 'd', 'e'])
    ).toEqual({
      track: ['a', 'b', 'c', 'd', 'e'],
      rollLines: 2
    });
  });
});

describe('isCotRollingWindowStep', () => {
  it('requires the live CoT metadata flag', () => {
    expect(
      isCotRollingWindowStep({
        metadata: { [COT_ROLLING_WINDOW_METADATA_KEY]: true }
      })
    ).toBe(true);
    expect(isCotRollingWindowStep({ metadata: { avatarName: 'Bot' } })).toBe(
      false
    );
  });
});

describe('formatStepElapsedClock', () => {
  it('keeps seconds under one minute', () => {
    expect(formatStepElapsedClock(0)).toBe('');
    expect(formatStepElapsedClock(12)).toBe(' @ 12 s.');
    expect(formatStepElapsedClock(59)).toBe(' @ 59 s.');
  });

  it('switches to mm:ss from one minute', () => {
    expect(formatStepElapsedClock(60)).toBe(' @ 01:00');
    expect(formatStepElapsedClock(75)).toBe(' @ 01:15');
    expect(formatStepElapsedClock(3599)).toBe(' @ 59:59');
  });

  it('switches to hh:mm:ss from one hour', () => {
    expect(formatStepElapsedClock(3600)).toBe(' @ 01:00:00');
    expect(formatStepElapsedClock(3661)).toBe(' @ 01:01:01');
  });
});

describe('getStepChildTaskCount', () => {
  it('uses the persisted live CoT line total', () => {
    expect(
      getStepChildTaskCount({
        metadata: {
          [COT_ROLLING_WINDOW_METADATA_KEY]: true,
          [COT_LIVE_LINE_COUNT_METADATA_KEY]: 12
        }
      })
    ).toBe(12);
  });

  it('counts nested non-message steps when no persisted total exists', () => {
    expect(
      getStepChildTaskCount({
        steps: [
          { type: 'tool' },
          { type: 'assistant_message' },
          { type: 'llm' }
        ]
      })
    ).toBe(2);
  });
});
