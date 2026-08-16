import { describe, expect, it } from "vitest";
import { parseIdeaPaste } from "../client/src/lib/ideaPaste";

describe("parseIdeaPaste", () => {
  it("maps pasted notes into Idea ID fields", () => {
    const result = parseIdeaPaste("제목: 손글씨 폰트 자동 제작\n설명: 업로드한 시트에서 글리프를 분리한다.\n#font #creator-tool\nhttps://example.com/reference");
    expect(result.title).toBe("손글씨 폰트 자동 제작");
    expect(result.description).toBe("업로드한 시트에서 글리프를 분리한다.");
    expect(result.tags).toEqual(["font", "creator-tool"]);
    expect(result.sourceUrl).toBe("https://example.com/reference");
    expect(result.originalText).toContain("글리프");
  });

  it("uses the first line as a title when no labels are provided", () => {
    const result = parseIdeaPaste("새로운 파일 포맷 아이디어\n브랜드 단위로 원본과 결과물을 묶는다.");
    expect(result.title).toBe("새로운 파일 포맷 아이디어");
    expect(result.description).toContain("브랜드 단위");
  });
});
