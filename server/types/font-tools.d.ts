declare module "potrace" {
  export function trace(source: Buffer, options: Record<string, unknown>, callback: (error: Error | null, svg: string) => void): void;
}

declare module "opentype.js";

declare module "svg-path-parser" {
  type SvgCommand = {
    command: "moveto" | "lineto" | "curveto" | "quadratic curveto" | "closepath";
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  interface Parser {
    (path: string): SvgCommand[];
    makeAbsolute(commands: SvgCommand[]): SvgCommand[];
  }
  const parseSVG: Parser;
  export = parseSVG;
}
