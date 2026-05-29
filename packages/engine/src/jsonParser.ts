// Strict-then-forgiving JSON parser for LLM output. Tries in order:
//   1. Direct JSON.parse on the trimmed text.
//   2. Extract from ```json``` fenced block.
//   3. Slice between first { and last } and parse.
//   4. Apply best-effort regex repair (trailing commas, missing commas
//      between adjacent values) and try again.
//
// On final failure, logs the first 800 chars of the raw model output so we
// can see what the LLM did wrong (the standard error message only shows
// the position, not the surrounding context).
export function parseJsonLoose<T>(raw: string): T {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      // fall through
    }
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const slice = trimmed.slice(first, last + 1);
    try {
      return JSON.parse(slice) as T;
    } catch {
      // Last resort: try repairing common LLM-output malformations.
      const repaired = repairJsonString(slice);
      try {
        return JSON.parse(repaired) as T;
      } catch (err) {
        console.error(
          `[parseJsonLoose] all strategies failed. Raw output (first 800 chars):\n${raw.slice(0, 800)}`,
        );
        throw err;
      }
    }
  }

  console.error(
    `[parseJsonLoose] no { ... } found. Raw output (first 800 chars):\n${raw.slice(0, 800)}`,
  );
  throw new Error(`Failed to parse JSON from model output: ${raw.slice(0, 200)}`);
}

// Best-effort repair of LLM-typical JSON syntax errors. Targeted at the two
// most common failures we see in practice:
//   1. Trailing comma before } or ].
//   2. Missing comma between two adjacent JSON values (the specific error
//      mode we hit at position 3390).
//
// Deliberately conservative — does NOT try to fix unclosed strings,
// unbalanced braces, or strip JS-style comments. The comment-stripping
// path was previously included but would corrupt JSON string values
// containing `//` (e.g. URLs like "https://example.com"); since LLMs in
// `responseFormat: "json_object"` mode essentially never emit comments,
// dropping that step is a net win for safety.
function repairJsonString(s: string): string {
  return s
    // 1. Strip trailing commas before } or ].
    .replace(/,(\s*[}\]])/g, "$1")
    // 2. Insert missing commas between two adjacent JSON values. The cases:
    //      } { → },{        ] [ → ],[        } [ → },[        ] { → ],{
    //      "string" "key"   "string" {       "string" [
    //      number then "key" / { / [
    //
    //    The regex looks for a closing token (} ] " or a digit) followed by
    //    a newline and an opening token (} ] " a letter), and inserts a
    //    comma between them. Requires the newline (\s*\n\s*) so it only
    //    fires across line boundaries, never within a single-line value.
    .replace(/(\}|\]|"|\d)(\s*\n\s*)(\{|\[|")/g, "$1,$2$3");
}
