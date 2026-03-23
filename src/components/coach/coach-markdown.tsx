"use client";

import { T } from "@/lib/coach-tokens";

/**
 * Lightweight markdown renderer for APEX coach messages.
 * Handles: **bold**, - lists, 1. ordered lists, `code`, line breaks.
 * No external library — keeps bundle small.
 */
export function CoachMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag
          key={key++}
          style={{
            margin: "6px 0",
            paddingLeft: "20px",
            color: T.text1,
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {listItems}
        </Tag>,
      );
      listItems = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(
        <li key={key++} style={{ marginBottom: "2px" }}>
          {renderInline(trimmed.replace(/^[-*]\s+/, ""))}
        </li>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(
        <li key={key++} style={{ marginBottom: "2px" }}>
          {renderInline(trimmed.replace(/^\d+\.\s+/, ""))}
        </li>,
      );
      continue;
    }

    flushList();

    // Empty line = paragraph break
    if (!trimmed) {
      elements.push(<div key={key++} style={{ height: "8px" }} />);
      continue;
    }

    // Regular text
    elements.push(
      <p
        key={key++}
        style={{
          margin: 0,
          color: T.text1,
          fontSize: "14px",
          lineHeight: "1.5",
          whiteSpace: "pre-wrap",
        }}
      >
        {renderInline(trimmed)}
      </p>,
    );
  }

  flushList();

  return <div>{elements}</div>;
}

/** Render inline formatting: **bold**, `code` */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** or `code`
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={key++} style={{ fontWeight: 700, color: T.text1 }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code
          key={key++}
          style={{
            background: T.glassBg,
            border: `1px solid ${T.glassBorder}`,
            borderRadius: T.r8,
            padding: "1px 5px",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          {match[3]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
