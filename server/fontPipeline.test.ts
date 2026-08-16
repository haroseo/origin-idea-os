import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { buildHandfont, vectorPathFromSvg } from "./fontPipeline";

describe("Handfont vector path conversion", () => {
  it("converts a traced SVG outline into a normalized OpenType path", () => {
    const path = vectorPathFromSvg('<svg><path d="M0 0 L100 0 L50 100 Z"/></svg>');
    expect(path.commands.length).toBeGreaterThanOrEqual(4);
    expect(path.commands[0]?.type).toBe("M");
    expect(path.commands[path.commands.length - 1]?.type).toBe("Z");
  });

  it("generates installable TTF and web WOFF2 bytes from a raster ink sample", async () => {
    const image = new PNG({ width: 96, height: 96, colorType: 6 });
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const index = (image.width * y + x) << 2;
        const localX = x % 32;
        const localY = y % 32;
        const ink = (localX > 10 && localX < 22 && localY > 4 && localY < 28) || (localY > 13 && localY < 19 && localX > 4 && localX < 28);
        image.data[index] = ink ? 24 : 255;
        image.data[index + 1] = ink ? 24 : 255;
        image.data[index + 2] = ink ? 24 : 255;
        image.data[index + 3] = 255;
      }
    }
    const sample = PNG.sync.write(image);
    const result = await buildHandfont(sample, "Origin Test Hand");
    expect(result.ttf.subarray(0, 4).toString("ascii")).toBe("\u0000\u0001\u0000\u0000");
    expect(result.woff2.subarray(0, 4).toString("ascii")).toBe("wOF2");
    expect(result.glyphs).toContain("가");
  }, 30000);
});
