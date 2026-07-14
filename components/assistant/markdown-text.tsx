import type { ReactNode } from "react";

type MarkdownTone = "dark" | "adaptive";

type MarkdownTextProps = {
  text: string;
  compact?: boolean;
  /** "dark" mantiene el texto claro para paneles oscuros fijos; "adaptive" sigue el tema activo. */
  tone?: MarkdownTone;
};

const palettes = {
  dark: {
    body: "text-slate-300",
    headingStrong: "text-white",
    headingSoft: "text-sky-100",
    strong: "text-slate-100",
    emphasis: "text-sky-100"
  },
  adaptive: {
    body: "text-slate-600 dark:text-slate-300",
    headingStrong: "text-slate-900 dark:text-white",
    headingSoft: "text-sky-700 dark:text-sky-100",
    strong: "text-slate-900 dark:text-slate-100",
    emphasis: "text-sky-700 dark:text-sky-100"
  }
} as const;

export function MarkdownText({ text, compact = false, tone = "dark" }: MarkdownTextProps) {
  const palette = palettes[tone];
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
          <li key={`${item}-${index}`} className={`list-disc text-sm leading-6 ${palette.body}`}>
            {formatInline(item, palette)}
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
        <h4 key={index} className={`${compact ? "mt-3" : "mt-4"} text-sm font-black ${palette.headingSoft}`}>
          {formatInline(line.slice(4), palette)}
        </h4>
      );
      return;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={index} className={`${compact ? "mt-3" : "mt-4"} text-base font-black ${palette.headingStrong}`}>
          {formatInline(line.slice(3), palette)}
        </h3>
      );
      return;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={index} className={`${compact ? "mt-2" : "mt-3"} text-lg font-black leading-7 ${palette.headingStrong}`}>
          {formatInline(line.slice(2), palette)}
        </h2>
      );
      return;
    }

    blocks.push(
      <p key={index} className={`text-sm leading-6 ${palette.body}`}>
        {formatInline(line, palette)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-2">{blocks}</div>;
}

function formatInline(text: string, palette: (typeof palettes)[MarkdownTone]) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className={`font-black ${palette.strong}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <strong key={`${part}-${index}`} className={`font-bold ${palette.emphasis}`}>
          {part.slice(1, -1)}
        </strong>
      );
    }

    return part;
  });
}
