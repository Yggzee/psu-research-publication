import React from "react";

interface FormattedChatMessageProps {
  text: string;
  isUser?: boolean;
  className?: string;
}

/**
 * Parses inline markdown:
 * - **bold** -> <strong>
 * - *italic* or _italic_ -> <em>
 * - `code` -> <code>
 * - [Ref X] -> citation badge
 * - strips any rogue accidental asterisks
 */
function parseInline(raw: string, isUser: boolean): React.ReactNode[] {
  if (!raw) return [];

  // Normalize duplicate or sloppy asterisks like **** or ** **
  const cleanedText = raw
    .replace(/\*{3,}/g, "**")
    .replace(/\*\*\s+\*\*/g, " ");

  // Match: [Ref X], **bold**, *italic*, _italic_, `code`
  const regex = /(\[Ref\s*\d+\]|\*\*[^*]+?\*\*|\*[^*]+?\*|_[^_]+?_|`[^`]+?`)/g;
  const parts = cleanedText.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // 1. Citation Reference: [Ref 1]
    if (part.startsWith("[Ref") && part.endsWith("]")) {
      return (
        <span
          key={idx}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mx-0.5 align-baseline ${
            isUser
              ? "bg-white/20 text-white"
              : "bg-brand-soft text-brand border border-brand/20"
          }`}
        >
          {part}
        </span>
      );
    }

    // 2. Bold text: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2).trim();
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {inner}
        </strong>
      );
    }

    // 3. Italic text: *text* or _text_
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      const inner = part.slice(1, -1).trim();
      return (
        <em key={idx} className="italic opacity-90">
          {inner}
        </em>
      );
    }

    // 4. Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-muted/60 font-mono text-[11px]"
        >
          {inner}
        </code>
      );
    }

    // 5. Plain text - remove any stray double asterisks that were unclosed
    const sanitized = part.replace(/\*\*/g, "");
    return <React.Fragment key={idx}>{sanitized}</React.Fragment>;
  });
}

/**
 * Beautiful, readable chat message renderer that eliminates raw markdown symbols (like ** asterisks)
 * and turns them into clean HTML typography with lists, paragraphs, and reference badges.
 */
export function FormattedChatMessage({
  text,
  isUser = false,
  className = "",
}: FormattedChatMessageProps) {
  if (!text) return null;

  // Split into lines to parse structured blocks (lists vs paragraphs)
  const rawLines = text.split("\n");

  type Block =
    | { type: "paragraph"; text: string }
    | { type: "bullet-list"; items: string[] }
    | { type: "numbered-list"; items: string[] }
    | { type: "heading"; level: number; text: string };

  const blocks: Block[] = [];
  let currentList: { type: "bullet" | "numbered"; items: string[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: currentParagraphLines.join(" "),
      });
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      if (currentList.type === "bullet") {
        blocks.push({ type: "bullet-list", items: currentList.items });
      } else {
        blocks.push({ type: "numbered-list", items: currentList.items });
      }
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty line -> separates paragraphs / lists
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Heading: # Heading or ## Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    // Unordered bullet item: * item, - item, • item, + item
    const bulletMatch = trimmed.match(/^[*•\-+]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "bullet") {
        flushList();
        currentList = { type: "bullet", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Numbered list item: 1. item, 2. item, etc.
    const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "numbered") {
        flushList();
        currentList = { type: "numbered", items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      continue;
    }

    // Indented sub-item inside a list
    if (line.match(/^\s{2,}[*•\-+]\s+(.*)$/)) {
      const subBullet = line.replace(/^\s{2,}[*•\-+]\s+/, "");
      if (currentList) {
        currentList.items.push(subBullet);
        continue;
      }
    } else if (line.match(/^\s{2,}\d+[\.\)]\s+(.*)$/)) {
      const subNum = line.replace(/^\s{2,}\d+[\.\)]\s+/, "");
      if (currentList) {
        currentList.items.push(subNum);
        continue;
      }
    }

    // Otherwise, normal paragraph line
    if (currentList) {
      flushList();
    }
    currentParagraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return (
    <div className={`space-y-2 text-xs sm:text-sm leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case "heading": {
            return (
              <h4
                key={bIdx}
                className="font-bold text-foreground text-xs sm:text-sm pt-1 tracking-tight"
              >
                {parseInline(block.text, isUser)}
              </h4>
            );
          }
          case "bullet-list": {
            return (
              <ul
                key={bIdx}
                className="space-y-1.5 my-1.5 pl-4 list-disc marker:text-muted-foreground/70"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {parseInline(item, isUser)}
                  </li>
                ))}
              </ul>
            );
          }
          case "numbered-list": {
            return (
              <ol
                key={bIdx}
                className="space-y-1.5 my-1.5 pl-4 list-decimal marker:font-semibold marker:text-muted-foreground/80"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {parseInline(item, isUser)}
                  </li>
                ))}
              </ol>
            );
          }
          case "paragraph":
          default: {
            return (
              <p key={bIdx} className="leading-relaxed">
                {parseInline(block.text, isUser)}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
