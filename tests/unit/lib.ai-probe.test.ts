import { describe, it, expect } from 'vitest';
import { extractAnswer, validateRule, evaluateProbeTransition } from '@/lib/ai-probe';

describe('extractAnswer', () => {
  it('stringifies the whole body when path is empty', () => {
    expect(extractAnswer({ a: 1 })).toBe('{"a":1}');
    expect(extractAnswer('plain text')).toBe('plain text');
    expect(extractAnswer(42)).toBe('42');
  });

  it('walks a simple dot-path', () => {
    expect(extractAnswer({ reply: 'olá' }, 'reply')).toBe('olá');
  });

  it('walks numeric array indices (OpenAI-style)', () => {
    const body = { choices: [{ message: { content: 'Paris' } }] };
    expect(extractAnswer(body, 'choices.0.message.content')).toBe('Paris');
  });

  it('returns empty string on a missing path', () => {
    expect(extractAnswer({ reply: 'x' }, 'nope.deep')).toBe('');
    expect(extractAnswer({ arr: [] }, 'arr.5')).toBe('');
  });

  it('stringifies a non-string leaf', () => {
    expect(extractAnswer({ data: { n: 3 } }, 'data')).toBe('{"n":3}');
  });
});

describe('validateRule', () => {
  it('non_empty passes on content, fails on blank', () => {
    expect(validateRule('hi', 'non_empty').ok).toBe(true);
    expect(validateRule('   ', 'non_empty').ok).toBe(false);
  });

  it('defaults to non_empty when rule is null/unknown', () => {
    expect(validateRule('hi', null).ok).toBe(true);
    expect(validateRule('', null).ok).toBe(false);
  });

  it('contains: matches case-insensitively', () => {
    expect(validateRule('The capital is Paris.', 'contains:paris').ok).toBe(true);
    expect(validateRule('The capital is Paris.', 'contains:London').ok).toBe(false);
  });
});

describe('evaluateProbeTransition', () => {
  it('stays up on a good answer with no prior fails', () => {
    expect(evaluateProbeTransition(0, 2, true)).toMatchObject({
      status: 'up',
      consecutiveFails: 0,
      transition: 'none',
    });
  });

  it('debounces a blip — no transition before the threshold', () => {
    const t1 = evaluateProbeTransition(0, 2, false);
    expect(t1).toMatchObject({ status: 'up', consecutiveFails: 1, transition: 'none' });
  });

  it('flips down exactly when the threshold is crossed', () => {
    const t = evaluateProbeTransition(1, 2, false);
    expect(t).toMatchObject({ status: 'down', consecutiveFails: 2, transition: 'down' });
  });

  it('does not re-signal down while already stuck down', () => {
    const t = evaluateProbeTransition(5, 2, false);
    expect(t).toMatchObject({ status: 'down', transition: 'none' });
  });

  it('recovers on a good answer after failures', () => {
    const t = evaluateProbeTransition(5, 2, true);
    expect(t).toMatchObject({ status: 'up', consecutiveFails: 0, transition: 'up' });
  });

  it('threshold of 1 trips on the first bad answer', () => {
    const t = evaluateProbeTransition(0, 1, false);
    expect(t).toMatchObject({ status: 'down', transition: 'down' });
  });
});
