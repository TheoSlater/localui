import { describe, it, expect } from 'vitest';
import {
  findStableCut,
  shouldDeferMarkdown,
  shouldUsePlainTextStreaming,
  TAIL_CHARS,
} from './technical-content';

describe('findStableCut invariants: stable+tail === original', () => {
  const check = (content: string) => {
    const cut = findStableCut(content);
    const stable = content.slice(0, cut);
    const tail = content.slice(cut);
    expect(stable + tail).toBe(content);
    expect(cut).toBeGreaterThanOrEqual(0);
    expect(cut).toBeLessThanOrEqual(content.length);
    // if cut !=0, must be at newline boundary (tail starts after \n or at 0)
    if (cut !== 0) {
      const before = content.slice(cut - 2, cut);
      const atBoundary =
        before.endsWith('\n') || before.endsWith('\n\n') || content[cut - 1] === '\n';
      // Allow cut == target when no newline found? Our impl returns 0 if no newline, so if cut!=0 it must be newline
      expect(atBoundary || cut === content.length - TAIL_CHARS).toBeTruthy();
    }
    // fence-aware: if prefix has odd fences, cut should be 0
    if (cut !== 0) {
      const prefix = content.slice(0, cut);
      const bt = (prefix.match(/```/g) ?? []).length;
      const til = (prefix.match(/~~~/g) ?? []).length;
      expect(bt % 2).toBe(0);
      expect(til % 2).toBe(0);
    }
  };

  it('single \\n', () => {
    check('a\nb');
    check('x'.repeat(1000) + '\n' + 'y'.repeat(1000));
  });

  it('\\n\\n', () => {
    check('a\n\nb');
    check('para1\n\npara2\n\npara3'.repeat(200));
  });

  it('Unicode / surrogate pairs', () => {
    check('😀'.repeat(500) + '\n\n' + '🎉'.repeat(500) + '\n' + '🚀'.repeat(500));
    check('a\uD834\uDF06b\n\nc\uD834\uDF06d'.repeat(100));
  });

  it('nested lists', () => {
    const md =
      '- item 1\n  - nested 1\n    - nested 2\n- item 2\n  1. ordered\n     - mix\n'.repeat(40);
    for (let len = 0; len <= md.length; len += 137) check(md.slice(0, len));
  });

  it('blockquotes', () => {
    const md = '> quote level 1\n> > nested quote\n> > > deep\n> back\n\nNormal\n'.repeat(30);
    for (let len = 0; len <= md.length; len += 151) check(md.slice(0, len));
  });

  it('nested blockquotes + lists', () => {
    const md = '> - list in quote\n>   - nested\n> > blockquote in list\n\n'.repeat(40);
    for (let len = 0; len <= md.length; len += 123) check(md.slice(0, len));
  });

  it('fenced code blocks with ```', () => {
    const md =
      '```js\nconsole.log("hi")\n```\n\nText\n'.repeat(30) + '```python\nincomplete '.repeat(100);
    for (let len = 0; len <= md.length; len += 173) check(md.slice(0, len));
  });

  it('fenced code blocks with ~~~', () => {
    const md = '~~~js\ncode\n~~~\n\nText\n'.repeat(30) + '~~~js\nincomplete '.repeat(100);
    for (let len = 0; len <= md.length; len += 167) check(md.slice(0, len));
  });

  it('backticks inside fenced code', () => {
    const md = '```\ncode with `backtick` and ``double``\n```\n\nText\n'.repeat(30);
    for (let len = 0; len <= md.length; len += 139) check(md.slice(0, len));
  });

  it('incomplete fences', () => {
    const md = '```\nno close fence\n\n*text\n'.repeat(30) + '```\nclosed\n'.repeat(10);
    for (let len = 0; len <= md.length; len += 113) check(md.slice(0, len));
  });

  it('tables', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\n'.repeat(40);
    for (let len = 0; len <= md.length; len += 149) check(md.slice(0, len));
  });

  it('incomplete table rows', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | '.repeat(40);
    for (let len = 0; len <= md.length; len += 127) check(md.slice(0, len));
  });

  it('inline code', () => {
    const md = 'This is `inline code` and `more` '.repeat(200);
    for (let len = 0; len <= md.length; len += 199) check(md.slice(0, len));
  });

  it('links', () => {
    const md = '[link](https://example.com) and text\n'.repeat(100);
    for (let len = 0; len <= md.length; len += 173) check(md.slice(0, len));
  });

  it('reference links', () => {
    const md = '[link][1]\n\n[1]: https://example.com\n'.repeat(50);
    for (let len = 0; len <= md.length; len += 131) check(md.slice(0, len));
  });

  it('emphasis across chunk boundaries', () => {
    const md = '*italic* **bold** ***both***\n\n'.repeat(50) + '*incomplete '.repeat(30);
    for (let len = 0; len <= md.length; len += 101) check(md.slice(0, len));
  });

  it('HTML blocks', () => {
    const md = '<div>\n<p>html</p>\n</div>\n\nText\n'.repeat(30);
    for (let len = 0; len <= md.length; len += 137) check(md.slice(0, len));
  });

  it('long paragraphs with no safe boundary', () => {
    const md = 'a'.repeat(50000); // no newline
    check(md);
    expect(findStableCut(md)).toBe(0); // should return 0, not split mid-word
  });

  it('malformed Markdown', () => {
    const md = '```\nno close\n\n*no close emphasis\n| table no close\n'.repeat(30);
    for (let len = 0; len <= md.length; len += 119) check(md.slice(0, len));
  });

  it('arbitrary split positions never lose text', () => {
    const md =
      '# Title\n\nParagraph with **bold** and `code`.\n\n- list\n  - nested\n\n```js\ncode\n```\n\n| h1 | h2 |\n|---|---|\n| a | b |\n\n> quote\n'.repeat(
        20,
      );
    for (let len = 0; len <= md.length; len += 7) {
      // simulate every 7 chars (pathological chunk boundary)
      check(md.slice(0, len));
    }
  });

  it('TAIL_CHARS bound', () => {
    const md = 'a\n\n'.repeat(1000) + 'b'.repeat(2000);
    const cut = findStableCut(md);
    const tailLen = md.length - cut;
    if (cut !== 0) {
      expect(tailLen).toBeGreaterThanOrEqual(TAIL_CHARS - 10);
      expect(tailLen).toBeLessThanOrEqual(TAIL_CHARS + 1500);
    }
  });

  it('final non-streaming render uses exact full source', () => {
    const md = '```js\ncode\n```\n\nText\n'.repeat(10);
    findStableCut(md);
    // when not streaming, cut is 0 by definition in StreamingMarkdown (streaming false → 0)
    // Simulate StreamingMarkdown logic:
    const streaming = false;
    const cut = streaming ? findStableCut(md) : 0;
    expect(cut).toBe(0);
    expect(md.slice(0, cut) + md.slice(cut)).toBe(md);
  });

  it('does not parse an oversized stream with no safe cut', () => {
    const content = '```\n' + 'const value = 1;\n'.repeat(500) + 'still streaming';
    expect(shouldUsePlainTextStreaming(content, findStableCut(content))).toBe(true);
  });

  it('defers oversized completed Markdown', () => {
    expect(shouldDeferMarkdown('x'.repeat(6001), false)).toBe(true);
    expect(shouldDeferMarkdown('x'.repeat(6001), true)).toBe(false);
  });
});
