import wrapAnsi from "wrap-ansi";
import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";
import stripAnsi from "strip-ansi";

export function wrapPlain(text, width) {
  return String(text || "")
    .split("\n")
    .flatMap((line) => wrapAnsi(line, Math.max(10, width), { hard: true, trim: false, wordWrap: true }).split("\n"));
}

function lineKind(line) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "remove";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) return "meta";
  return "context";
}

function visibleSlice(text, width) {
  if (stringWidth(stripAnsi(text)) <= width) return text;
  return sliceAnsi(text, 0, Math.max(1, width - 1)) + "…";
}

export function formatDiffLines(diff, width) {
  const gutterWidth = 5;
  const bodyWidth = Math.max(20, width - gutterWidth - 1);
  let oldLine = 0;
  let newLine = 0;

  return String(diff || "")
    .split("\n")
    .flatMap((raw) => {
      const kind = lineKind(raw);
      if (kind === "hunk") {
        const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = Number(match[1]);
          newLine = Number(match[2]);
        }
        return [{ kind, text: raw }];
      }
      if (kind === "meta") return [{ kind, text: visibleSlice(raw, width) }];

      let gutter = "     ";
      if (kind === "add") gutter = String(newLine++).padStart(4, " ") + " ";
      else if (kind === "remove") gutter = String(oldLine++).padStart(4, " ") + " ";
      else if (oldLine || newLine) {
        gutter = String(newLine || oldLine).padStart(4, " ") + " ";
        oldLine++;
        newLine++;
      }

      const wrapped = wrapAnsi(raw, bodyWidth, { hard: true, trim: false, wordWrap: false }).split("\n");
      return wrapped.map((part, index) => ({
        kind,
        text: index === 0 ? `${gutter}${visibleSlice(part, bodyWidth)}` : `${" ".repeat(gutterWidth)}${visibleSlice(part, bodyWidth)}`,
      }));
    });
}
