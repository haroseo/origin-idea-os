import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  brands,
  creativeAssets,
  ideas,
  ideaVersions,
  InsertUser,
  radarReports,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function hashIdeaSnapshot(input: {
  title: string;
  originalText: string;
  description?: string | null;
  tags: string[];
}) {
  return createHash("sha256")
    .update(JSON.stringify({ ...input, tags: [...input.tags].sort() }))
    .digest("hex");
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스 연결을 준비하지 못했습니다.");
  return db;
}

export async function listBrandsByUser(userId: number) {
  const db = await requireDb();
  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).orderBy(desc(brands.updatedAt));
  const allIdeas = await db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(desc(ideas.updatedAt));
  return brandRows.map((brand) => ({
    ...brand,
    ideaCount: allIdeas.filter((idea) => idea.brandId === brand.id).length,
    latestIdea: allIdeas.find((idea) => idea.brandId === brand.id) ?? null,
  }));
}

export async function createBrand(input: {
  userId: number;
  name: string;
  color: string;
  tone: string;
  description?: string;
}) {
  const db = await requireDb();
  const result = await db.insert(brands).values(input);
  const id = Number(result[0].insertId);
  const [brand] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return brand;
}

export async function getBrandDetail(userId: number, brandId: number) {
  const db = await requireDb();
  const [brand] = await db.select().from(brands).where(and(eq(brands.id, brandId), eq(brands.userId, userId))).limit(1);
  if (!brand) return null;
  const brandIdeas = await db.select().from(ideas).where(and(eq(ideas.brandId, brandId), eq(ideas.userId, userId))).orderBy(desc(ideas.updatedAt));
  return { ...brand, ideas: brandIdeas };
}

export async function createIdea(input: {
  userId: number;
  brandId: number;
  title: string;
  originalText: string;
  description?: string;
  sourceUrl?: string;
  tags: string[];
}) {
  const db = await requireDb();
  const contentHash = hashIdeaSnapshot(input);
  const result = await db.insert(ideas).values({
    userId: input.userId,
    brandId: input.brandId,
    title: input.title,
    originalText: input.originalText,
    description: input.description ?? null,
    sourceUrl: input.sourceUrl ?? null,
    tags: JSON.stringify(input.tags),
    contentHash,
  });
  const ideaId = Number(result[0].insertId);
  await db.insert(ideaVersions).values({
    ideaId,
    versionNumber: 1,
    contentHash,
    changeSummary: "원본 아이디어를 기록했습니다.",
    snapshot: JSON.stringify(input),
  });
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  return idea;
}

export async function listIdeasByBrand(userId: number, brandId: number) {
  const db = await requireDb();
  return db.select().from(ideas).where(and(eq(ideas.userId, userId), eq(ideas.brandId, brandId))).orderBy(desc(ideas.updatedAt));
}

export async function getIdeaDetail(userId: number, ideaId: number) {
  const db = await requireDb();
  const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId))).limit(1);
  if (!idea) return null;
  const versions = await db.select().from(ideaVersions).where(eq(ideaVersions.ideaId, ideaId)).orderBy(desc(ideaVersions.versionNumber));
  const reports = await db.select().from(radarReports).where(and(eq(radarReports.ideaId, ideaId), eq(radarReports.userId, userId))).orderBy(desc(radarReports.createdAt));
  const assets = await db.select().from(creativeAssets).where(and(eq(creativeAssets.ideaId, ideaId), eq(creativeAssets.userId, userId))).orderBy(desc(creativeAssets.createdAt));
  return { ...idea, versions, reports, assets };
}

export async function updateIdea(input: {
  userId: number;
  ideaId: number;
  title: string;
  originalText: string;
  description?: string;
  tags: string[];
  changeSummary: string;
}) {
  const db = await requireDb();
  const [existing] = await db.select().from(ideas).where(and(eq(ideas.id, input.ideaId), eq(ideas.userId, input.userId))).limit(1);
  if (!existing) throw new Error("아이디어를 찾지 못했습니다.");
  const contentHash = hashIdeaSnapshot(input);
  await db.update(ideas).set({
    title: input.title,
    originalText: input.originalText,
    description: input.description ?? null,
    tags: JSON.stringify(input.tags),
    contentHash,
    updatedAt: new Date(),
  }).where(eq(ideas.id, input.ideaId));
  const existingVersions = await db.select().from(ideaVersions).where(eq(ideaVersions.ideaId, input.ideaId));
  await db.insert(ideaVersions).values({
    ideaId: input.ideaId,
    versionNumber: existingVersions.length + 1,
    contentHash,
    changeSummary: input.changeSummary || "아이디어 내용을 정제했습니다.",
    snapshot: JSON.stringify({
      title: input.title,
      originalText: input.originalText,
      description: input.description,
      tags: input.tags,
    }),
  });
  return getIdeaDetail(input.userId, input.ideaId);
}

export async function saveRadarReport(userId: number, ideaId: number, resultJson: string) {
  const db = await requireDb();
  await db.insert(radarReports).values({ userId, ideaId, resultJson });
}

export async function createCreativeAsset(input: {
  userId: number;
  brandId: number;
  ideaId?: number;
  name: string;
  assetType: "font" | "format" | "license";
  status?: string;
  storageKey?: string;
  storageUrl?: string;
  metadata: string;
}) {
  const db = await requireDb();
  const result = await db.insert(creativeAssets).values({
    ...input,
    ideaId: input.ideaId ?? null,
    status: input.status ?? "ready",
    storageKey: input.storageKey ?? null,
    storageUrl: input.storageUrl ?? null,
  });
  const id = Number(result[0].insertId);
  const [asset] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, id)).limit(1);
  return asset;
}

export async function getPublicReleaseAsset(assetId: number) {
  const db = await requireDb();
  const [asset] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, assetId)).limit(1);
  if (!asset || asset.assetType !== "license") return null;
  return asset;
}
