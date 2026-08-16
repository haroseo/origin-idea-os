import { describe, expect, it } from "vitest";
import { makeFormatFiles, makeLicense } from "./originUtils";

describe("Format Forge generators", () => {
  it("normalizes an extension and returns a specification plus two SDKs", () => {
    const result = makeFormatFiles(".mind-web", "application/vnd.mindweb+json", {
      type: "object",
      properties: { title: { type: "string" } },
    });

    expect(result.safeExtension).toBe("mind-web");
    expect(result.spec).toContain("application/vnd.mindweb+json");
    expect(result.typeScript).toContain("parseMindWeb");
    expect(result.python).toContain("parse_mind_web");
  });
});

describe("License Composer", () => {
  it("writes selected commercial and attribution conditions", () => {
    const license = makeLicense({
      assetName: "Origin Sans",
      ownerName: "서하루",
      personal: true,
      commercial: true,
      attribution: true,
    });

    expect(license).toContain("Origin Sans LICENSE");
    expect(license).toContain("개인 및 상업적 이용");
    expect(license).toContain("원작자 표기를 포함해야 합니다");
  });
});
