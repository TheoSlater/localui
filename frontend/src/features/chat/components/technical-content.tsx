import {
  cloneElement,
  isValidElement,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { parseMarkdown } from '@tanstack/markdown/parser';
import { renderMarkdownReact } from '@tanstack/markdown/react';
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming';

export const LARGE_TEXT_THRESHOLD = 1800;
export const MAX_ANIMATED_WORDS = 90;
export const TAIL_CHARS = 900;
export const STREAMING_PARSE_LIMIT = 6000;

export function findStableCut(content: string): number {
  if (content.length < 1500) return 0;
  const target = content.length - TAIL_CHARS;
  let cut = content.lastIndexOf('\n\n', target);
  let offset = 2;
  if (cut === -1) {
    cut = content.lastIndexOf('\n', target);
    offset = 1;
  }
  if (cut === -1) return 0;
  cut += offset;
  if (cut < content.length * 0.25) return 0;
  const prefix = content.slice(0, cut);
  const backtickFences = (prefix.match(/```/g) ?? []).length;
  const tildeFences = (prefix.match(/~~~/g) ?? []).length;
  if (backtickFences % 2 === 1 || tildeFences % 2 === 1) return 0;
  return cut;
}

export function shouldUsePlainTextStreaming(content: string, cut: number): boolean {
  return content.length > STREAMING_PARSE_LIMIT && cut === 0;
}

export function shouldDeferMarkdown(content: string, streaming: boolean): boolean {
  return !streaming && content.length > STREAMING_PARSE_LIMIT;
}

export const TechnicalContent = memo(function TechnicalContent({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const defer = shouldDeferMarkdown(content, streaming);
  const [preparedContent, setPreparedContent] = useState<string | undefined>(() =>
    defer ? undefined : content,
  );

  useEffect(() => {
    if (!defer) return;
    setPreparedContent(undefined);
    const timer = window.setTimeout(() => setPreparedContent(content), 50);
    return () => window.clearTimeout(timer);
  }, [content, defer]);

  if (defer && preparedContent !== content) {
    return <div className="technical-content whitespace-pre-wrap">{content}</div>;
  }

  const document = useMemo(
    () =>
      parseMarkdown(
        content,
        streaming ? { extensions: [streamingMarkdownExtension()] } : undefined,
      ),
    [content, streaming],
  );
  const renderedContent = useMemo(() => {
    const rendered = renderMarkdownReact(document);
    if (!streaming) return rendered;
    if (content.length > STREAMING_PARSE_LIMIT) return rendered;
    return renderStreamingNodes(rendered);
  }, [document, streaming, content.length]);
  return <div className="technical-content">{renderedContent}</div>;
});

export const StreamingMarkdown = memo(function StreamingMarkdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const cut = useMemo(() => {
    if (!streaming || content.length > STREAMING_PARSE_LIMIT) return 0;
    return findStableCut(content);
  }, [content, streaming]);
  if (streaming && shouldUsePlainTextStreaming(content, cut)) {
    return <div className="technical-content whitespace-pre-wrap">{content}</div>;
  }
  if (!streaming || cut === 0) {
    return <TechnicalContent content={content} streaming={streaming} />;
  }
  const stable = content.slice(0, cut);
  const tail = content.slice(cut);
  return (
    <>
      <TechnicalContent content={stable} streaming={false} />
      <TechnicalContent content={tail} streaming={true} />
    </>
  );
});

function renderStreamingNodes(node: ReactNode, key = 'stream'): ReactNode {
  if (typeof node === 'string') return <StreamingTextNode key={key} text={node} />;
  if (Array.isArray(node))
    return node.map((child, index) => renderStreamingNodes(child, `${key}-${index}`));
  if (!isValidElement(node) || node.type === 'pre' || node.type === 'code') return node;
  if (node.props.children === undefined) return node;
  return cloneElement(
    node,
    { key: node.key ?? key },
    renderStreamingNodes(node.props.children, key),
  );
}

let cachedStreamGap: number | null = null;
function getStreamGap(): number {
  if (cachedStreamGap !== null) return cachedStreamGap;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--stream-gap');
    cachedStreamGap = Number.parseFloat(raw) || 60;
  } catch {
    cachedStreamGap = 60;
  }
  return cachedStreamGap;
}

const isWord = (part: string) => part.length > 0 && !/^\s+$/.test(part);

function StreamingTextNode({ text }: { text: string }) {
  const shouldAnimate = text.length <= LARGE_TEXT_THRESHOLD;
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(() => {
    if (!shouldAnimate) return 0;
    let c = 0;
    for (const p of parts) if (isWord(p)) c++;
    return c;
  }, [parts, shouldAnimate]);
  const previousWordCount = useRef(0);
  const [revealedWords, setRevealedWords] = useState(0);

  useEffect(() => {
    if (!shouldAnimate) {
      setRevealedWords(wordCount);
      return;
    }
    if (wordCount > MAX_ANIMATED_WORDS) {
      setRevealedWords(wordCount);
      return;
    }
    const start = Math.min(previousWordCount.current, wordCount);
    previousWordCount.current = wordCount;
    if (start >= wordCount) return;

    let next = start;
    let timer: number | undefined;
    const gap = getStreamGap();
    const revealNext = () => {
      next += 1;
      setRevealedWords(next);
      if (next < wordCount) timer = window.setTimeout(revealNext, gap);
    };
    revealNext();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [wordCount, shouldAnimate]);

  if (!shouldAnimate || wordCount > MAX_ANIMATED_WORDS) return <>{text}</>;

  let wordIndex = 0;
  return (
    <>
      {parts.map((part, index) => {
        if (!isWord(part)) return part;
        const currentWord = wordIndex++;
        return (
          <span
            key={`${currentWord}-${index}`}
            className={`t-stream-w ${currentWord < revealedWords ? 'is-in' : ''}`}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}
