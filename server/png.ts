import { inflateSync } from "node:zlib";
// Bound and validate PNG scanlines before PDFKit's asynchronous decoder can throw.
export function validatePng(bytes: Buffer) {
  if (
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw Error("Invalid PNG");
  let offset = 8,
    width = 0,
    height = 0,
    depth = 0,
    channels = 0,
    interlace = 0,
    ended = false,
    palette = false;
  const compressed: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset),
      type = bytes.toString("ascii", offset + 4, offset + 8);
    if (size > bytes.length - offset - 12) throw Error("Truncated PNG");
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === "IHDR") {
      if (offset !== 8 || size !== 13) throw Error("Invalid PNG header");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      const colour = data[9],
        depths: Record<number, number[]> = {
          0: [1, 2, 4, 8, 16],
          2: [8, 16],
          3: [1, 2, 4, 8],
          4: [8, 16],
          6: [8, 16],
        };
      channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[
        colour
      ];
      if (
        !width ||
        !height ||
        width > 2000 ||
        height > 2000 ||
        !depths[colour]?.includes(depth) ||
        data[10] !== 0 ||
        data[11] !== 0 ||
        ![0, 1].includes(data[12])
      )
        throw Error("Unsupported PNG header");
      interlace = data[12];
      palette = colour !== 3;
    } else if (type === "PLTE") {
      if (!size || size % 3 || size > 768) throw Error("Invalid PNG palette");
      palette = true;
    } else if (type === "IDAT") compressed.push(data);
    else if (type === "IEND") {
      if (size !== 0 || offset + 12 !== bytes.length)
        throw Error("Invalid PNG end");
      ended = true;
      break;
    }
    offset += size + 12;
  }
  if (!ended || !channels || !palette || !compressed.length)
    throw Error("Incomplete PNG");
  const passes = interlace
      ? [
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ]
      : [[0, 0, 1, 1]],
    rows: number[] = [];
  for (const [x, y, dx, dy] of passes) {
    const w = Math.max(0, Math.ceil((width - x) / dx)),
      h = Math.max(0, Math.ceil((height - y) / dy));
    if (w && h)
      for (let row = 0; row < h; row++)
        rows.push(Math.ceil((w * channels * depth) / 8));
  }
  const expected = rows.reduce((n, row) => n + row + 1, 0);
  let decoded: Buffer;
  try {
    decoded = inflateSync(Buffer.concat(compressed), {
      maxOutputLength: expected + 1,
    });
  } catch {
    throw Error("Corrupt PNG compressed data");
  }
  if (decoded.length !== expected) throw Error("Invalid PNG scanline length");
  let position = 0;
  for (const length of rows) {
    if (decoded[position] > 4) throw Error("Invalid PNG scanline filter");
    position += length + 1;
  }
}
