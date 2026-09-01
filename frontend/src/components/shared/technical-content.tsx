import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { parseMarkdown } from '@tanstack/markdown/parser';
import { renderMarkdownReact } from '@tanstack/markdown/react';
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming';

export function TechnicalContent({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
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
    return streaming ? renderStreamingNodes(rendered) : rendered;
  }, [document, streaming]);
  return <div className="technical-content">{renderedContent}</div>;
}

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

function StreamingTextNode({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const isWord = (part: string) => part.length > 0 && !/^\s+$/.test(part);
  const wordCount = parts.filter(isWord).length;
  const previousWordCount = useRef(0);
  const [revealedWords, setRevealedWords] = useState(0);

  useEffect(() => {
    const start = Math.min(previousWordCount.current, wordCount);
    previousWordCount.current = wordCount;
    if (start >= wordCount) return;

    let next = start;
    let timer: number | undefined;
    const gap =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--stream-gap'),
      ) || 60;
    const revealNext = () => {
      next += 1;
      setRevealedWords(next);
      if (next < wordCount) timer = window.setTimeout(revealNext, gap);
    };
    revealNext();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [wordCount]);

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
