import { describe, expect, it } from 'vitest';
import { parseGmReferenceBody } from './gmReferenceBody.js';

describe('parseGmReferenceBody', () => {
  it('returns empty array for empty body', () => {
    expect(parseGmReferenceBody('')).toEqual([]);
    expect(parseGmReferenceBody('   ')).toEqual([]);
  });

  it('parses a single paragraph block', () => {
    const body = 'This is a paragraph.\nWith two lines.';
    const result = parseGmReferenceBody(body);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('paragraph');
    expect(result[0]?.lines).toEqual(['This is a paragraph.', 'With two lines.']);
  });

  it('parses multiple paragraph blocks separated by blank lines', () => {
    const body = 'First paragraph.\n\nSecond paragraph.';
    const result = parseGmReferenceBody(body);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('paragraph');
    expect(result[0]?.lines).toEqual(['First paragraph.']);
    expect(result[1]?.type).toBe('paragraph');
    expect(result[1]?.lines).toEqual(['Second paragraph.']);
  });

  it('parses a flat list', () => {
    const body = '- First item\n- Second item\n- Third item';
    const result = parseGmReferenceBody(body);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('list');
    expect(result[0]?.items).toHaveLength(3);
    expect(result[0]?.items?.[0]).toEqual({ level: 0, text: 'First item' });
    expect(result[0]?.items?.[1]).toEqual({ level: 0, text: 'Second item' });
    expect(result[0]?.items?.[2]).toEqual({ level: 0, text: 'Third item' });
  });

  it('parses a two-level nested list', () => {
    const body = '- First\n  - Nested one\n  - Nested two\n- Second';
    const result = parseGmReferenceBody(body);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('list');
    expect(result[0]?.items).toHaveLength(2);
    expect(result[0]?.items?.[0]?.text).toBe('First');
    expect(result[0]?.items?.[0]?.children).toHaveLength(2);
    expect(result[0]?.items?.[0]?.children?.[0]).toEqual({ level: 1, text: 'Nested one' });
    expect(result[0]?.items?.[1]?.text).toBe('Second');
  });

  it('parses a block with text lines followed by a list', () => {
    const body = 'Introduction text.\n\n- List item one\n- List item two';
    const result = parseGmReferenceBody(body);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('paragraph');
    expect(result[0]?.lines).toEqual(['Introduction text.']);
    expect(result[1]?.type).toBe('list');
    expect(result[1]?.items).toHaveLength(2);
  });

  it('keeps every line of a block that mixes text and a list, in order', () => {
    const body = 'Some text.\nAnother line.\n- List item\n  - Nested\nClosing line.';
    const result = parseGmReferenceBody(body);
    expect(result.map((b) => b.type)).toEqual(['paragraph', 'list', 'paragraph']);
    expect(result[0]?.lines).toEqual(['Some text.', 'Another line.']);
    expect(result[1]?.items?.[0]?.children?.[0]?.text).toBe('Nested');
    expect(result[2]?.lines).toEqual(['Closing line.']);
  });
});
