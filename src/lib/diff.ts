/**
 * Minimal dependency-free line diff (LCS-based) for showing suggested content
 * edits in the admin panel. Lessons are at most a few hundred lines, so the
 * O(n·m) table is fine.
 */
export type DiffLine = { type: "same" | "add" | "del"; text: string };

export function lineDiff(a: string, b: string): DiffLine[] {
  const A = a.replace(/\r\n/g, "\n").split("\n");
  const B = b.replace(/\r\n/g, "\n").split("\n");
  const n = A.length;
  const m = B.length;
  // dp[i][j] = length of LCS of A[i:] and B[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        A[i] === B[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ type: "same", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: A[i] });
      i++;
    } else {
      out.push({ type: "add", text: B[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: A[i++] });
  while (j < m) out.push({ type: "add", text: B[j++] });
  return out;
}

/** Collapse long runs of unchanged lines to keep the diff readable. */
export function collapseDiff(lines: DiffLine[], context = 3): DiffLine[] {
  const keep = new Array(lines.length).fill(false);
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].type !== "same") {
      for (let d = -context; d <= context; d++) {
        const idx = k + d;
        if (idx >= 0 && idx < lines.length) keep[idx] = true;
      }
    }
  }
  const out: DiffLine[] = [];
  let hidden = 0;
  for (let k = 0; k < lines.length; k++) {
    if (keep[k]) {
      if (hidden > 0) {
        out.push({ type: "same", text: `… ${hidden} unchanged line${hidden === 1 ? "" : "s"} …` });
        hidden = 0;
      }
      out.push(lines[k]);
    } else {
      hidden++;
    }
  }
  if (hidden > 0)
    out.push({ type: "same", text: `… ${hidden} unchanged line${hidden === 1 ? "" : "s"} …` });
  return out;
}
