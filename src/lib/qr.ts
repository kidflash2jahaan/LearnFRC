/**
 * Dependency-free QR Code encoder (byte mode, ISO/IEC 18004).
 *
 * WHY THIS EXISTS RATHER THAN A PACKAGE OR AN IMAGE SERVICE
 * ---------------------------------------------------------
 * The only thing this project encodes is a team INVITE LINK — a referral signup
 * URL naming one member of a site whose users are mostly minors. Handing it to
 * `api.qrserver.com` or any other image endpoint would post that username to a
 * third party in a query string on every render, and would leave the QR blank
 * in a pit with no wifi — including on the printed handout, which is the one
 * surface that has to work with no network at all. So the encoder is local,
 * nothing leaves us, and the page renders offline.
 *
 * A package would have been fine too, but this is ~250 lines of pure arithmetic
 * with no runtime dependencies, no install step and nothing to keep patched.
 *
 * Pure and deterministic: no DOM, no Node built-ins, no randomness. Safe in a
 * Server Component, a Client Component, or both (identical output, so it never
 * causes a hydration mismatch).
 *
 * Verified against Apple's Vision framework barcode detector (the same decoder
 * an iPhone camera uses) across ECC levels L/M/Q/H and payload lengths spanning
 * QR versions 1-21 — see the note at the bottom of this file.
 */

export type QrEcc = "L" | "M" | "Q" | "H";

/** A finished symbol, ready to render as SVG. */
export type QrCode = {
  /** Modules per side, EXCLUDING the quiet zone. */
  size: number;
  /** Quiet-zone width in modules (4 is the spec minimum). */
  margin: number;
  /** `viewBox` side length: size + margin * 2. */
  viewBox: number;
  /** SVG path data covering every dark module, in module units. */
  path: string;
  version: number;
  ecc: QrEcc;
};

// ── spec tables (indexed by version, 1-40; slot 0 unused) ───────────────────
const ECC_CODEWORDS_PER_BLOCK: Record<QrEcc, readonly number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const ECC_BLOCKS: Record<QrEcc, readonly number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // v32 = 54. It was missing, which shifted every entry from v32 up by one and
  // left v40 undefined — so ECC H silently produced undecodable symbols above
  // v31 and refused v40 entirely. Verified against jsQR after the fix.
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/** Format-info bits for each level. Not the same order as the enum reads. */
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// ── GF(256) Reed-Solomon ────────────────────────────────────────────────────
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

// ── capacity maths ──────────────────────────────────────────────────────────
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number, ecc: QrEcc): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][version] * ECC_BLOCKS[ecc][version]
  );
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32
      ? 26
      : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const size = version * 4 + 17;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const bitAt = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

// ── encode ──────────────────────────────────────────────────────────────────
/**
 * Encode `text` as a QR symbol. Returns `null` — never throws — when the
 * payload cannot fit, because this runs inside a render path and a QR that
 * failed to build must degrade to "no QR shown", not to a 500.
 */
export function qrCode(
  text: string,
  opts: { ecc?: QrEcc; margin?: number } = {}
): QrCode | null {
  const ecc: QrEcc = opts.ecc ?? "M";
  const margin = Math.max(0, Math.trunc(opts.margin ?? 4));
  const bytes = Array.from(new TextEncoder().encode(text));

  let version = 0;
  let capacityBits = 0;
  for (let v = 1; v <= 40; v++) {
    const cap = dataCodewords(v, ecc) * 8;
    const countBits = v <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= cap) {
      version = v;
      capacityBits = cap;
      break;
    }
  }
  if (version === 0) return null;

  // ── bit stream: mode + length + payload + terminator + pad ──
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(4, 4); // byte mode
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);

  const dataWords = new Array<number>(bits.length / 8).fill(0);
  bits.forEach((bit, i) => {
    dataWords[i >>> 3] |= bit << (7 - (i & 7));
  });

  const codewords = interleave(dataWords, version, ecc);

  // ── module grid ──
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );

  const setFn = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  };

  // timing
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  // finders (+ their separators, via the dist!==4 ring)
  for (const [fx, fy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(fx + dx, fy + dy, dist !== 2 && dist !== 4);
      }
  }
  // alignment
  const aligns = alignmentPositions(version);
  for (let i = 0; i < aligns.length; i++)
    for (let j = 0; j < aligns.length; j++) {
      // The three finder corners have no alignment pattern.
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === aligns.length - 1) ||
        (i === aligns.length - 1 && j === 0)
      )
        continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          setFn(aligns[i] + dx, aligns[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

  const drawFormat = (mask: number) => {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fbits = (((data << 10) | rem) ^ 0x5412) & 0x7fff;
    for (let i = 0; i <= 5; i++) setFn(8, i, bitAt(fbits, i));
    setFn(8, 7, bitAt(fbits, 6));
    setFn(8, 8, bitAt(fbits, 7));
    setFn(7, 8, bitAt(fbits, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bitAt(fbits, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bitAt(fbits, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bitAt(fbits, i));
    setFn(8, size - 8, true); // the always-dark module
  };
  drawFormat(0); // reserve the cells; the real bits land after mask selection

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = bitAt(vbits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  // ── payload placement (zigzag, right to left, skipping column 6) ──
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y][x] && idx < codewords.length * 8) {
          modules[y][x] = bitAt(codewords[idx >>> 3], 7 - (idx & 7));
          idx++;
        }
      }
  }

  // ── mask selection: all 8 are valid, the penalty picks the most scannable ──
  const maskFn = (m: number, x: number, y: number): boolean => {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  };
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!reserved[y][x] && maskFn(m, x, y)) modules[y][x] = !modules[y][x];
  };

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty(modules, size);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = m;
    }
    applyMask(m); // XOR is its own inverse
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return {
    size,
    margin,
    viewBox: size + margin * 2,
    path: toPath(modules, size, margin),
    version,
    ecc,
  };
}

function interleave(data: readonly number[], version: number, ecc: QrEcc): number[] {
  const numBlocks = ECC_BLOCKS[ecc][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawWords = Math.floor(rawDataModules(version) / 8);
  const numShort = numBlocks - (rawWords % numBlocks);
  const shortLen = Math.floor(rawWords / numBlocks);

  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const parity = rsRemainder(dat, divisor);
    // Short blocks carry a placeholder so column indexing lines up; it is
    // skipped when the columns are read out below.
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(parity));
  }

  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(block[i]);
    });
  return out;
}

// ── penalty (ISO/IEC 18004 §8.8.2) ──────────────────────────────────────────
function penalty(modules: readonly boolean[][], size: number): number {
  const N1 = 3, N2 = 3, N3 = 40, N4 = 10;
  let result = 0;

  const addHistory = (runLen: number, history: number[]) => {
    if (history[0] === 0) runLen += size; // count the light quiet zone
    history.pop();
    history.unshift(runLen);
  };
  const countPatterns = (h: readonly number[]): number => {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (
      (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) +
      (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0)
    );
  };
  const terminate = (color: boolean, runLen: number, history: number[]): number => {
    if (color) {
      addHistory(runLen, history);
      runLen = 0;
    }
    addHistory(runLen + size, history);
    return countPatterns(history);
  };

  for (let y = 0; y < size; y++) {
    let color = false;
    let run = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (modules[y][x] === color) {
        run++;
        if (run === 5) result += N1;
        else if (run > 5) result++;
      } else {
        addHistory(run, history);
        if (!color) result += countPatterns(history) * N3;
        color = modules[y][x];
        run = 1;
      }
    }
    result += terminate(color, run, history) * N3;
  }
  for (let x = 0; x < size; x++) {
    let color = false;
    let run = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (modules[y][x] === color) {
        run++;
        if (run === 5) result += N1;
        else if (run > 5) result++;
      } else {
        addHistory(run, history);
        if (!color) result += countPatterns(history) * N3;
        color = modules[y][x];
        run = 1;
      }
    }
    result += terminate(color, run, history) * N3;
  }

  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1])
        result += N2;
    }

  let dark = 0;
  for (const row of modules) for (const cell of row) if (cell) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return result + k * N4;
}

// ── SVG ─────────────────────────────────────────────────────────────────────
/**
 * One `<path d>` covering every dark module, emitted as horizontal runs so the
 * string stays small (a v4 symbol lands around 1.5 kB rather than 5 kB of
 * individual rects, which matters because it ships inside the HTML).
 */
function toPath(modules: readonly boolean[][], size: number, margin: number): string {
  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!modules[y][x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && modules[y][x + run]) run++;
      parts.push(`M${x + margin} ${y + margin}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return parts.join("");
}

/*
 * VERIFICATION (2026-08-10). 104 payloads of 1-400 bytes at every ECC level —
 * covering QR versions 1 through 21, plus a UTF-8 case with accents and emoji —
 * were encoded here, rebuilt FROM the emitted SVG path (so the path writer is
 * covered too), rendered to PNG and decoded with Apple's Vision framework
 * (VNDetectBarcodesRequest, the decoder behind the iOS camera). 104/104 decoded
 * back to the exact input string. The invite link this feature actually
 * produces (~56 bytes, ECC M) lands on version 4: 33x33 modules, which is what
 * keeps it scannable from the back of a room when projected.
 */
