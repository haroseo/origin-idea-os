import { describe, expect, it, vi } from "vitest";
import { originRouter } from "./routers/origin";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  createBrand: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  saveRadarReport: vi.fn(),
  getPublicReleaseAsset: vi.fn(),
}));

const llmMock = vi.hoisted(() => ({
  listLLMModels: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => dbMock);
vi.mock("./_core/llm", () => llmMock);
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

function createContext() {
  return {
    user: {
      id: 42,
      openId: "origin-test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {},
    res: {},
  } as unknown as TrpcContext;
}

describe("Origin server router", () => {
  it("creates a brand in the authenticated user's vault", async () => {
    dbMock.createBrand.mockResolvedValue({ id: 7, name: "NULY" });
    const result = await originRouter.createCaller(createContext()).brand.create({ name: "NULY", color: "#526D68", tone: "Quiet intelligence", description: "Private creative vault" });
    expect(result).toEqual({ id: 7, name: "NULY" });
    expect(dbMock.createBrand).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, name: "NULY" }));
  });

  it("passes a pasted source URL into Idea ID creation", async () => {
    dbMock.createIdea.mockResolvedValue({ id: 12, sourceUrl: "https://example.com/reference" });
    const result = await originRouter.createCaller(createContext()).idea.create({ brandId: 7, title: "붙여넣은 아이디어", originalText: "원본 텍스트가 충분히 긴 아이디어입니다.", description: "자동 분류된 설명", sourceUrl: "https://example.com/reference", tags: ["creator-tool"] });
    expect(result).toEqual({ id: 12, sourceUrl: "https://example.com/reference" });
    expect(dbMock.createIdea).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, brandId: 7, sourceUrl: "https://example.com/reference" }));
  });

  it("records an Idea ID update with an authenticated user", async () => {
    dbMock.updateIdea.mockResolvedValue({ id: 9, contentHash: "abc" });
    await originRouter.createCaller(createContext()).idea.update({ ideaId: 9, title: "Origin file", originalText: "This is a complete original idea.", description: "A private asset file.", tags: ["asset"], changeSummary: "문장을 보완했습니다." });
    expect(dbMock.updateIdea).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, ideaId: 9, changeSummary: "문장을 보완했습니다." }));
  });

  it("stores structured Radar output and exposes public release documents", async () => {
    llmMock.listLLMModels.mockResolvedValue({ data: [{ id: "gpt-5-mini" }] });
    llmMock.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ summary: "검토 완료", confidence: 0.6, sources: [], cards: [
      { label: "이미 있음", headline: "a", detail: "a", action: "a", strength: 0.5 },
      { label: "가까움", headline: "b", detail: "b", action: "b", strength: 0.5 },
      { label: "비어 있음", headline: "c", detail: "c", action: "c", strength: 0.5 },
      { label: "주의", headline: "d", detail: "d", action: "d", strength: 0.5 },
    ] }) } }] });
    const radar = await originRouter.createCaller(createContext()).radar.analyze({ ideaId: 9, title: "Origin asset", description: "An original creative asset workspace.", tags: ["asset"] });
    expect(radar.cards).toHaveLength(4);
    expect(dbMock.saveRadarReport).toHaveBeenCalledWith(42, 9, expect.any(String));

    dbMock.getPublicReleaseAsset.mockResolvedValue({ id: 11, assetType: "license", name: "License", metadata: JSON.stringify({ assetName: "Origin Sans", ownerName: "서하루", license: "Allowed" }), createdAt: new Date() });
    const release = await originRouter.createCaller(createContext()).release.get({ assetId: 11 });
    expect(release).toMatchObject({ id: 11, name: "Origin Sans", license: "Allowed" });
  });
});
