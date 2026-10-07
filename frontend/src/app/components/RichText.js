/** Minimal inline markdown (bold, code) and short-line answers — nothing else. */

export function RichText({ text }) {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="inline-code mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function Answer({ text }) {
  const blocks = String(text ?? "").split(/\n{2,}/);
  return blocks.map((block, index) => {
    const lines = block.split("\n");
    const bulleted = lines.every((l) => /^\s*[-*•]\s+/.test(l)) && lines.length > 1;
    if (bulleted) {
      return (
        <ul key={index} className="my-2.5 space-y-1.5">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden className="mt-[10px] h-[3px] w-[3px] flex-none rounded-full bg-[var(--line-3)]" />
              <span>
                <RichText text={line.replace(/^\s*[-*•]\s+/, "")} />
              </span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className={index ? "mt-3.5" : undefined}>
        <RichText text={block} />
      </p>
    );
  });
}
