import type { ReactNode } from "react";

type MarkdownTextProps = {
  text: string;
  compact?: boolean;
};

export function MarkdownText({ text, compact = false }: MarkdownTextProps) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (!listItems.length) {
      return;
    }

    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`} className={`${compact ? "my-2" : "my-3"} space-y-1 pl-4`}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="list-disc text-sm leading-6 text-slate-300">
            {formatInline(item)}
          </li>
        ))}
      </ul>
    );
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    const listMatch = line.match(/^[-*]\s+(.+)/);

    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList();

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={index} className={`${compact ? "mt-3" : "mt-4"} text-sm font-black text-sky-100`}>
          {formatInline(line.slice(4))}
        </h4>
      );
      return;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={index} className={`${compact ? "mt-3" : "mt-4"} text-base font-black text-white`}>
          {formatInline(line.slice(3))}
        </h3>
      );
      return;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={index} className={`${compact ? "mt-2" : "mt-3"} text-lg font-black leading-7 text-white`}>
          {formatInline(line.slice(2))}
        </h2>
      );
      return;
    }

    blocks.push(
      <p key={index} className="text-sm leading-6 text-slate-300">
        {formatInline(line)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-2">{blocks}</div>;
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-black text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <strong key={`${part}-${index}`} className="font-bold text-sky-100">
          {part.slice(1, -1)}
        </strong>
      );
    }

    return part;
  });
}
