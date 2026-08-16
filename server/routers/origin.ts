import { z } from "zod";
import * as db from "../db";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { storagePut } from "../storage";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { makeFormatFiles, makeLicense } from "../originUtils";
import { buildHandfont } from "../fontPipeline";

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(10);

const radarSchema = {
  name: "novelty_radar",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      confidence: { type: "number" },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            kind: { type: "string" },
          },
          required: ["title", "url", "kind"],
          additionalProperties: false,
        },
      },
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", enum: ["이미 있음", "가까움", "비어 있음", "주의"] },
            headline: { type: "string" },
            detail: { type: "string" },
            action: { type: "string" },
            strength: { type: "number" },
          },
          required: ["label", "headline", "detail", "action", "strength"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "confidence", "sources", "cards"],
    additionalProperties: false,
  },
} as const;

type GitHubSignal = { title: string; url: string; description: string; stars: number };

async function findGitHubSignals(query: string): Promise<GitHubSignal[]> {
  const searchTerms = query.split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
  if (!searchTerms) return [];
  try {
    const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerms)}&sort=stars&order=desc&per_page=3`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Origin-Idea-OS" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const body = await response.json() as { items?: Array<{ full_name: string; html_url: string; description: string | null; stargazers_count: number }> };
    return (body.items ?? []).map((item) => ({ title: item.full_name, url: item.html_url, description: item.description ?? "설명 없음", stars: item.stargazers_count }));
  } catch {
    return [];
  }
}

export const originRouter = router({
  release: router({
    get: publicProcedure.input(z.object({ assetId: z.number().int().positive() })).query(async ({ input }) => {
      const asset = await db.getPublicReleaseAsset(input.assetId);
      if (!asset) return null;
      const metadata = JSON.parse(asset.metadata) as { assetName?: string; ownerName?: string; license?: string };
      return { id: asset.id, name: metadata.assetName ?? asset.name, ownerName: metadata.ownerName ?? "Origin creator", license: metadata.license ?? "", createdAt: asset.createdAt };
    }),
  }),
  brand: router({
    list: protectedProcedure.query(({ ctx }) => db.listBrandsByUser(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), tone: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).optional() }))
      .mutation(({ ctx, input }) => db.createBrand({ ...input, userId: ctx.user.id })),
    detail: protectedProcedure.input(z.object({ brandId: z.number().int().positive() })).query(({ ctx, input }) => db.getBrandDetail(ctx.user.id, input.brandId)),
  }),
  idea: router({
    create: protectedProcedure
      .input(z.object({ brandId: z.number().int().positive(), title: z.string().trim().min(2).max(180), originalText: z.string().trim().min(8).max(12000), description: z.string().trim().max(2400).optional(), sourceUrl: z.string().url().max(2048).optional(), tags: tagsSchema }))
      .mutation(({ ctx, input }) => db.createIdea({ ...input, userId: ctx.user.id })),
    list: protectedProcedure.input(z.object({ brandId: z.number().int().positive() })).query(({ ctx, input }) => db.listIdeasByBrand(ctx.user.id, input.brandId)),
    detail: protectedProcedure.input(z.object({ ideaId: z.number().int().positive() })).query(({ ctx, input }) => db.getIdeaDetail(ctx.user.id, input.ideaId)),
    update: protectedProcedure
      .input(z.object({ ideaId: z.number().int().positive(), title: z.string().trim().min(2).max(180), originalText: z.string().trim().min(8).max(12000), description: z.string().trim().max(2400).optional(), tags: tagsSchema, changeSummary: z.string().trim().max(280).default("아이디어 내용을 정제했습니다.") }))
      .mutation(({ ctx, input }) => db.updateIdea({ ...input, userId: ctx.user.id })),
  }),
  radar: router({
    analyze: protectedProcedure
      .input(z.object({ ideaId: z.number().int().positive(), title: z.string().trim().min(2).max(180), description: z.string().trim().min(8).max(12000), tags: tagsSchema }))
      .mutation(async ({ ctx, input }) => {
        const models = await listLLMModels();
        const model = models.data.find((item) => item.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
        const githubSignals = await findGitHubSignals(`${input.title} ${input.tags.join(" ")}`);
        const githubContext = githubSignals.length
          ? githubSignals.map((signal) => `- ${signal.title} | ${signal.url} | ★${signal.stars} | ${signal.description}`).join("\n")
          : "- 현재 공개 GitHub 검색에서 신뢰 가능한 결과를 확보하지 못했습니다.";
        const response = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "당신은 창작 아이디어의 유사성 검토를 돕는 전략 분석가입니다. 단정적 법률 판단이나 전체 웹 검색 완료를 주장하지 마세요. 웹 제품·공개 코드 생태계·네이밍 관점의 조사 가설과 차별화 실행안을 한국어로 정리합니다. 반드시 각 라벨(이미 있음, 가까움, 비어 있음, 주의)을 한 번씩 포함한 네 장의 카드를 반환하세요. sources에는 제공된 GitHub 공개 검색 결과만 넣고, 제공되지 않은 URL을 지어내지 마세요." },
            { role: "user", content: `아이디어 제목: ${input.title}\n설명: ${input.description}\n태그: ${input.tags.join(", ")}\n\nGitHub 공개 검색 결과:\n${githubContext}` },
          ],
          response_format: { type: "json_schema", json_schema: radarSchema },
          maxTokens: 1800,
        });
        const raw = response.choices[0]?.message.content;
        if (typeof raw !== "string") throw new Error("레이더 분석 결과를 읽지 못했습니다.");
        const result = JSON.parse(raw) as { summary: string; confidence: number; sources: Array<{ title: string; url: string; kind: string }>; cards: unknown[] };
        await db.saveRadarReport(ctx.user.id, input.ideaId, JSON.stringify(result));
        return result;
      }),
  }),
  font: router({
    upload: protectedProcedure
      .input(z.object({ brandId: z.number().int().positive(), ideaId: z.number().int().positive().optional(), fileName: z.string().trim().min(1).max(180), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), contentBase64: z.string().min(40).max(7_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const bytes = Buffer.from(input.contentBase64, "base64");
        if (bytes.byteLength > 5_000_000) throw new Error("이미지는 5MB 이하로 업로드해 주세요.");
        const fileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
        const stamp = Date.now();
        const source = await storagePut(`handfont/${ctx.user.id}/${stamp}-${fileName}`, bytes, input.mimeType);
        const fontName = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()) || "Origin Handfont";
        const generated = await buildHandfont(bytes, fontName);
        const ttf = await storagePut(`handfont/${ctx.user.id}/${stamp}-${fileName.replace(/\.[^.]+$/, "")}.ttf`, generated.ttf, "font/ttf");
        const woff2 = await storagePut(`handfont/${ctx.user.id}/${stamp}-${fileName.replace(/\.[^.]+$/, "")}.woff2`, generated.woff2, "font/woff2");
        const asset = await db.createCreativeAsset({
          userId: ctx.user.id,
          brandId: input.brandId,
          ideaId: input.ideaId,
          name: fontName,
          assetType: "font",
          status: "font-ready",
          storageKey: ttf.key,
          storageUrl: ttf.url,
          metadata: JSON.stringify({ glyphs: generated.glyphs, sourceUrl: source.url, woff2Url: woff2.url, source: "handwriting-vectorized" }),
        });
        return {
          asset,
          previewUrl: source.url,
          ttfUrl: ttf.url,
          woff2Url: woff2.url,
          fontName,
          glyphs: generated.glyphs,
          glyphPreviews: generated.glyphSvgs.map((svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`),
        };
      }),
  }),
  format: router({
    generate: protectedProcedure
      .input(z.object({ brandId: z.number().int().positive(), ideaId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), extension: z.string().trim().min(2).max(24), mimeType: z.string().trim().regex(/^[a-z]+\/[a-z0-9.+-]+$/i), schemaJson: z.string().trim().min(2).max(12000) }))
      .mutation(async ({ ctx, input }) => {
        let schema: Record<string, unknown>;
        try { schema = JSON.parse(input.schemaJson) as Record<string, unknown>; } catch { throw new Error("스키마는 유효한 JSON이어야 합니다."); }
        const files = makeFormatFiles(input.extension, input.mimeType, schema);
        const asset = await db.createCreativeAsset({
          userId: ctx.user.id,
          brandId: input.brandId,
          ideaId: input.ideaId,
          name: input.name,
          assetType: "format",
          metadata: JSON.stringify({ extension: `.${files.safeExtension}`, mimeType: input.mimeType, schema }),
        });
        return { asset, extension: `.${files.safeExtension}`, ...files };
      }),
  }),
  license: router({
    generate: protectedProcedure
      .input(z.object({ brandId: z.number().int().positive(), ideaId: z.number().int().positive().optional(), assetName: z.string().trim().min(2).max(180), ownerName: z.string().trim().min(2).max(120), personal: z.boolean(), commercial: z.boolean(), attribution: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const license = makeLicense(input);
        const asset = await db.createCreativeAsset({
          userId: ctx.user.id,
          brandId: input.brandId,
          ideaId: input.ideaId,
          name: `${input.assetName} License`,
          assetType: "license",
          metadata: JSON.stringify({ ...input, license }),
        });
        return { asset, license, publicPath: `/release/${asset?.id ?? "draft"}` };
      }),
  }),
});
