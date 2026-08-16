import { createFont, woff2 } from "fonteditor-core";
import { Jimp, JimpMime } from "jimp";
import { trace } from "potrace";
import parseSVG from "svg-path-parser";

const GLYPH_SET = ["A", "a", "가", "나", "다", "라", "1", "2", "3"];

function traceRaster(buffer: Buffer) {
  return new Promise<string>((resolve, reject) => {
    trace(buffer, { threshold: 180, turdSize: 4, optCurve: true, optTolerance: 0.2 }, (error: Error | null, svg: string) => {
      if (error) reject(error);
      else resolve(svg);
    });
  });
}

async function splitGlyphCells(source: Buffer, columns = 3, rows = 3) {
  const image = await Jimp.read(source);
  if (image.bitmap.width < columns * 16 || image.bitmap.height < rows * 16) {
    throw new Error("글자 칸을 분리하려면 가로·세로 48px 이상의 손글씨 시트를 올려주세요.");
  }
  const cells: Buffer[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.floor((column * image.bitmap.width) / columns);
      const y = Math.floor((row * image.bitmap.height) / rows);
      const nextX = Math.floor(((column + 1) * image.bitmap.width) / columns);
      const nextY = Math.floor(((row + 1) * image.bitmap.height) / rows);
      const cell = image.clone().crop({ x, y, w: nextX - x, h: nextY - y });
      cells.push(Buffer.from(await cell.getBuffer(JimpMime.png)));
    }
  }
  return cells;
}

function extractPathData(svg: string) {
  return Array.from(svg.matchAll(/<path[^>]+d="([^"]+)"/g), (match) => match[1] ?? "").filter(Boolean);
}

type Coordinate = { x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };

function coordinateBounds(commands: Coordinate[]) {
  const values = commands.flatMap((command) => [command.x, command.y, command.x1, command.y1, command.x2, command.y2].filter((value): value is number => typeof value === "number"));
  if (!values.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const xValues = commands.flatMap((command) => [command.x, command.x1, command.x2].filter((value): value is number => typeof value === "number"));
  const yValues = commands.flatMap((command) => [command.y, command.y1, command.y2].filter((value): value is number => typeof value === "number"));
  return { minX: Math.min(...xValues), maxX: Math.max(...xValues), minY: Math.min(...yValues), maxY: Math.max(...yValues) };
}

type VectorCommand = { type: "M" | "L" | "C" | "Q" | "Z"; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };

export function vectorPathFromSvg(svg: string) {
  const parsed = extractPathData(svg).flatMap((pathData) => parseSVG.makeAbsolute(parseSVG(pathData)));
  const bounds = coordinateBounds(parsed);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(780 / width, 780 / height);
  const offsetX = 110 + (780 - width * scale) / 2;
  const offsetY = 110 + (780 - height * scale) / 2;
  const mapX = (value: number) => offsetX + (value - bounds.minX) * scale;
  const mapY = (value: number) => 890 - (value - bounds.minY) * scale;
  const commands: VectorCommand[] = [];

  parsed.forEach((command: { command: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }) => {
    if (command.command === "moveto" && command.x !== undefined && command.y !== undefined) commands.push({ type: "M", x: mapX(command.x), y: mapY(command.y) });
    if (command.command === "lineto" && command.x !== undefined && command.y !== undefined) commands.push({ type: "L", x: mapX(command.x), y: mapY(command.y) });
    if (command.command === "curveto" && command.x !== undefined && command.y !== undefined && command.x1 !== undefined && command.y1 !== undefined && command.x2 !== undefined && command.y2 !== undefined) {
      commands.push({ type: "C", x: mapX(command.x), y: mapY(command.y), x1: mapX(command.x1), y1: mapY(command.y1), x2: mapX(command.x2), y2: mapY(command.y2) });
    }
    if (command.command === "quadratic curveto" && command.x !== undefined && command.y !== undefined && command.x1 !== undefined && command.y1 !== undefined) {
      commands.push({ type: "Q", x: mapX(command.x), y: mapY(command.y), x1: mapX(command.x1), y1: mapY(command.y1) });
    }
    if (command.command === "closepath") commands.push({ type: "Z" });
  });
  return { commands };
}

function pathDataFromCommands(commands: VectorCommand[]) {
  return commands.map((command) => {
    if (command.type === "M" || command.type === "L") return `${command.type}${command.x} ${command.y}`;
    if (command.type === "C") return `C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`;
    if (command.type === "Q") return `Q${command.x1} ${command.y1} ${command.x} ${command.y}`;
    return "Z";
  }).join(" ");
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

export async function buildHandfont(source: Buffer, fontName: string) {
  const sourceSvg = await traceRaster(source);
  const fallbackOutline = vectorPathFromSvg(sourceSvg);
  if (fallbackOutline.commands.length < 3) throw new Error("글리프 윤곽을 찾지 못했습니다. 대비가 높은 손글씨 시트를 사용해 주세요.");
  const cells = await splitGlyphCells(source);
  const tracedCells = await Promise.all(cells.map(async (cell) => {
    try {
      const svg = await traceRaster(cell);
      const outline = vectorPathFromSvg(svg);
      return outline.commands.length >= 3 ? { outline, svg } : { outline: fallbackOutline, svg: sourceSvg };
    } catch {
      return { outline: fallbackOutline, svg: sourceSvg };
    }
  }));
  const glyphTags = GLYPH_SET.map((character, index) => {
    const glyphPath = pathDataFromCommands(tracedCells[index]?.outline.commands ?? fallbackOutline.commands);
    return `<glyph glyph-name="origin-${character.codePointAt(0)}" unicode="&#x${character.codePointAt(0)?.toString(16)};" horiz-adv-x="1000" d="${glyphPath}" />`;
  }).join("");
  const svgFont = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><defs><font id="origin-handfont" horiz-adv-x="1000"><font-face font-family="${escapeXml(fontName)}" font-style="Regular" units-per-em="1000" ascent="900" descent="-100" /><missing-glyph horiz-adv-x="1000" d="" />${glyphTags}</font></defs></svg>`;
  const editableFont = createFont(svgFont, { type: "svg" });
  const ttf = Buffer.from(editableFont.write({ type: "ttf" }) as ArrayBuffer);
  await woff2.init();
  const woff2Buffer = Buffer.from(editableFont.write({ type: "woff2" }) as ArrayBuffer);
  return { ttf, woff2: woff2Buffer, glyphs: GLYPH_SET, svg: sourceSvg, glyphSvgs: tracedCells.map((cell) => cell.svg) };
}
