import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { parseIdeaPaste, tagsToText } from "@/lib/ideaPaste";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Fingerprint,
  FolderPlus,
  Loader2,
  PenLine,
  Plus,
  Radar,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type BrandPreview = {
  id: number;
  name: string;
  color: string;
  tone: string;
  description: string;
  ideaCount: number;
};

const previewBrands: BrandPreview[] = [
  { id: -1, name: "ORIGIN LAB", color: "#A56444", tone: "Experimental systems", description: "생각을 작동하는 도구로 바꾸는 실험실", ideaCount: 12 },
  { id: -2, name: "NULY", color: "#526D68", tone: "Quiet intelligence", description: "조용하지만 정교한 인텔리전스", ideaCount: 7 },
  { id: -3, name: "VOIDRA", color: "#5A536A", tone: "Atmospheric identity", description: "아무것도 아닌 곳에서 만드는 정체성", ideaCount: 4 },
];

const previewIdea = {
  id: -1,
  title: "Idea ID — 창작 원본을 자산으로 만드는 파일",
  originalText: "아이디어의 원본 텍스트, 버전, 유사성 검증과 결과물을 하나의 이식 가능한 파일에 담는다. 이 파일은 단순 메모가 아니라 창작의 출발점이자 증거다.",
  description: "창작자가 여러 브랜드에서 만든 생각을 섞지 않고, 검증과 배포까지 한 번에 이어갈 수 있는 개인용 자산 포맷.",
  tags: ["asset-os", "file-format", "creator-tool"],
  contentHash: "65db49a9b40d8f0bcab1e7f2…",
  createdAt: new Date(),
};

type IdeaDisplay = {
  id: number;
  title: string;
  originalText: string;
  description?: string | null;
  tags: string[];
  contentHash: string;
  createdAt: Date | string | null;
};

const initialRadar = [
  { label: "이미 있음", title: "개인 지식 관리 도구", text: "메모와 프로젝트를 축적하는 도구는 많습니다. 다만 창작 원본·증거·결과물 흐름을 하나로 다루는 방향은 별도 포지셔닝이 필요합니다.", action: "‘문서’가 아닌 ‘자산’ 언어를 고정하세요.", color: "#9F684B" },
  { label: "가까움", title: "디지털 자산 생성 플랫폼", text: "폰트·라이선스·디자인 파일을 만드는 도구와 인접합니다. Origin은 제작 이전의 발상과 이력까지 품는다는 점이 다릅니다.", action: "변환 전후의 연결을 핵심 화면에 남기세요.", color: "#657B76" },
  { label: "비어 있음", title: "브랜드 단위의 원본 금고", text: "프로젝트보다 브랜드를 상위 단위로 두고 서로 격리하는 개인 창작 OS의 경험은 아직 얕은 영역입니다.", action: "금고 간 데이터 격리를 기본값으로 설계하세요.", color: "#7287A2" },
  { label: "주의", title: "이름·권리 표현", text: "등록 가능 여부나 선행 권리는 별도 공식 검색과 전문가 검토가 필요합니다. 레이더는 판단 보조로만 사용해야 합니다.", action: "검증 출처와 최종 결정을 분리해 보여주세요.", color: "#8E6874" },
];

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "방금 전";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createFormatFiles(extension: string, mimeType: string, schemaText: string) {
  const safe = extension.replace(/^\./, "").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "origin";
  const typeName = safe.replace(/(^|[-_])(\w)/g, (_, __, char) => char.toUpperCase());
  const schema = JSON.parse(schemaText || "{}");
  const pretty = JSON.stringify(schema, null, 2);
  return {
    safe,
    spec: `# .${safe} Format Specification\n\n- **MIME type:** \`${mimeType}\`\n- **Container:** JSON\n- **Version:** 1.0.0\n\n## Schema\n\n\`\`\`json\n${pretty}\n\`\`\`\n`,
    ts: `export const ${typeName}Schema = ${pretty} as const;\n\nexport type ${typeName}File = typeof ${typeName}Schema;\n\nexport function parse${typeName}(raw: string) {\n  return JSON.parse(raw) as ${typeName}File;\n}\n`,
    py: `import json\nfrom typing import Any\n\nMIME_TYPE = "${mimeType}"\nSCHEMA: dict[str, Any] = ${pretty}\n\ndef parse_${safe.replace(/-/g, "_")}(raw: str) -> dict[str, Any]:\n    return json.loads(raw)\n`,
  };
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState(-1);
  const [selectedIdeaId, setSelectedIdeaId] = useState(-1);
  const [fontPreview, setFontPreview] = useState<string | null>(null);
  const [fontResult, setFontResult] = useState<{ fontName: string; ttfUrl: string; woff2Url: string; glyphs: string[]; glyphPreviews: string[] } | null>(null);
  const [radarCards, setRadarCards] = useState(initialRadar);
  const [radarSummary, setRadarSummary] = useState("아이디어의 독자성을 명확히 만드는 네 가지 관점입니다.");
  const [radarSources, setRadarSources] = useState<Array<{ title: string; url: string; kind: string }>>([]);
  const [formatName, setFormatName] = useState("Origin Idea File");
  const [extension, setExtension] = useState("idea");
  const [mimeType, setMimeType] = useState("application/vnd.origin.idea+json");
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {\n    "title": { "type": "string" },\n    "content": { "type": "string" },\n    "version": { "type": "number" }\n  },\n  "required": ["title", "content"]\n}');
  const [formatResult, setFormatResult] = useState<ReturnType<typeof createFormatFiles> | null>(null);
  const [license, setLicense] = useState({ personal: true, commercial: true, attribution: true, assetName: "Origin Sans" });
  const [licenseResult, setLicenseResult] = useState<string | null>(null);
  const [releasePath, setReleasePath] = useState<string | null>(null);

  const brandQuery = trpc.origin.brand.list.useQuery(undefined, { retry: false });
  const activeRemoteBrands = brandQuery.data ?? [];
  const isPreview = activeRemoteBrands.length === 0;
  const brands = (isPreview ? previewBrands : activeRemoteBrands) as BrandPreview[];
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? brands[0] ?? previewBrands[0];
  const ideaQuery = trpc.origin.idea.detail.useQuery({ ideaId: selectedIdeaId }, { enabled: selectedIdeaId > 0, retry: false });
  const remoteIdea = ideaQuery.data;
  const activeIdea: IdeaDisplay = selectedIdeaId > 0 && remoteIdea ? { ...remoteIdea, tags: JSON.parse(remoteIdea.tags) as string[] } : previewIdea;

  const brandCreate = trpc.origin.brand.create.useMutation({
    onSuccess: (brand) => {
      brandQuery.refetch();
      setSelectedBrandId(brand?.id ?? -1);
      setBrandModalOpen(false);
      toast.success("브랜드 금고를 만들었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const ideaCreate = trpc.origin.idea.create.useMutation({
    onSuccess: (idea) => {
      setSelectedIdeaId(idea?.id ?? -1);
      setIdeaModalOpen(false);
      toast.success("Idea ID를 기록하고 첫 증거 버전을 만들었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const radarAnalyze = trpc.origin.radar.analyze.useMutation({
    onSuccess: (result) => {
      setRadarSummary(result.summary);
      const cards = result.cards as Array<{ label: string; headline: string; detail: string; action: string }>;
      setRadarCards(cards.map((card) => ({ label: card.label, title: card.headline, text: card.detail, action: card.action, color: radarColor(card.label) })));
      setRadarSources(result.sources as Array<{ title: string; url: string; kind: string }>);
      setLocation("/radar");
      toast.success("Novelty Radar 분석을 기록했습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const ideaUpdate = trpc.origin.idea.update.useMutation({
    onSuccess: () => {
      ideaQuery.refetch();
      toast.success("새 버전과 SHA-256 증거 기록을 남겼습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const fontUpload = trpc.origin.font.upload.useMutation({
    onSuccess: (result) => {
      setFontResult(result);
      toast.success("손글씨를 벡터화해 TTF와 WOFF2 파일로 만들었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const formatGenerate = trpc.origin.format.generate.useMutation({
    onSuccess: (result) => {
      setFormatResult({ safe: result.safeExtension, spec: result.spec, ts: result.typeScript, py: result.python });
      toast.success(`.${result.extension.replace(".", "")} 포맷 명세와 SDK를 브랜드 금고에 저장했습니다.`);
    },
    onError: (error) => toast.error(error.message),
  });
  const licenseGenerate = trpc.origin.license.generate.useMutation({
    onSuccess: (result) => {
      setLicenseResult(result.license);
      setReleasePath(result.publicPath);
      toast.success("LICENSE와 공개 배포 경로를 만들었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });

  const page = location.slice(1) || "vault";
  const title = useMemo(() => ({
    vault: ["브랜드별 원본을,", "<em>흩어지지 않게.</em>"],
    idea: ["생각 하나를,", "<em>증명 가능한 원본으로.</em>"],
    radar: ["비슷한 것을 넘어,", "<em>비어 있는 곳을 찾습니다.</em>"],
    handfont: ["손글씨의 결을,", "<em>당신의 폰트로.</em>"],
    format: ["파일 하나에,", "<em>새로운 언어를 담습니다.</em>"],
    license: ["창작 조건까지,", "<em>명확하게 남깁니다.</em>"],
  }[page] ?? ["브랜드별 원본을,", "<em>흩어지지 않게.</em>"]), [page]);

  function openPipeline(target: "font" | "format" | "radar") {
    setLocation(target === "font" ? "/handfont" : target === "format" ? "/format" : "/radar");
  }

  function handleRadar() {
    if (selectedIdeaId > 0) {
      radarAnalyze.mutate({ ideaId: selectedIdeaId, title: activeIdea.title, description: activeIdea.description ?? activeIdea.originalText, tags: activeIdea.tags });
      return;
    }
    setLocation("/radar");
    toast.message("미리보기 레이더를 열었습니다. 로그인 후 실제 Idea ID에 분석 기록을 저장할 수 있습니다.");
  }

  function handleFontFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("PNG, JPG, WEBP 이미지만 올릴 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFontPreview(String(reader.result));
    reader.readAsDataURL(file);
    if (selectedBrand.id > 0) {
      const uploadReader = new FileReader();
      uploadReader.onload = () => {
        const payload = String(uploadReader.result).split(",")[1];
        if (!payload) return;
        fontUpload.mutate({ brandId: selectedBrand.id, ideaId: selectedIdeaId > 0 ? selectedIdeaId : undefined, fileName: file.name, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", contentBase64: payload });
      };
      uploadReader.readAsDataURL(file);
    } else {
      toast.success("손글씨 시트를 읽었습니다. 글리프 분리 미리보기를 준비했습니다.");
    }
  }

  function handleFormatGenerate() {
    try {
      if (selectedBrand.id > 0) {
        formatGenerate.mutate({ brandId: selectedBrand.id, ideaId: selectedIdeaId > 0 ? selectedIdeaId : undefined, name: formatName, extension, mimeType, schemaJson: schemaText });
      } else {
        const result = createFormatFiles(extension, mimeType, schemaText);
        setFormatResult(result);
        toast.success(`.${result.safe} 포맷 명세와 SDK 초안을 만들었습니다.`);
      }
    } catch {
      toast.error("스키마는 유효한 JSON 형식이어야 합니다.");
    }
  }

  function handleLicenseGenerate() {
    const permitted = license.personal && license.commercial ? "개인 및 상업적 이용" : license.commercial ? "상업적 이용" : "개인적 이용";
    const result = `# ${license.assetName} LICENSE\n\nCopyright (c) ${new Date().getFullYear()} 서하루\n\n## 허용 범위\n\n본 자산은 ${permitted}이 허용됩니다.\n\n## 조건\n\n${license.attribution ? "이용 시 원작자 표기를 포함해야 합니다." : "원작자 표기는 권장되지만 필수는 아닙니다."}\n원본 파일 또는 파생 결과물을 재배포·판매하기 전에는 별도의 허가를 받아야 합니다.\n\n## 보증의 부인\n\n본 자산은 어떠한 명시적 또는 묵시적 보증 없이 제공됩니다.\n`;
    if (selectedBrand.id > 0) {
      licenseGenerate.mutate({ brandId: selectedBrand.id, ideaId: selectedIdeaId > 0 ? selectedIdeaId : undefined, assetName: license.assetName, ownerName: "서하루", personal: license.personal, commercial: license.commercial, attribution: license.attribution });
    } else {
      setLicenseResult(result);
      setReleasePath(null);
      toast.success("LICENSE와 공개 배포 초안을 만들었습니다.");
    }
  }

  return (
    <DashboardLayout>
      <div className="origin-page">
        <div className="origin-topline">
          <div>
            <p className="origin-eyebrow">{page === "vault" ? "BRAND VAULT / PRIVATE WORKSPACE" : `ORIGIN / ${page.toUpperCase()}`}</p>
            <h1 className="origin-heading">{title[0]}<br /><span dangerouslySetInnerHTML={{ __html: title[1] }} /></h1>
            <p className="origin-subhead">{isPreview ? "로컬 미리보기에서 Origin의 흐름을 확인하고 있습니다." : "브랜드별 원본과 결과물이 안전하게 분리되어 있습니다."}</p>
          </div>
          {page === "vault" ? <button className="origin-primary-button" onClick={() => setBrandModalOpen(true)}><Plus className="h-4 w-4" />금고 만들기</button> : <button className="origin-secondary-button" onClick={() => setLocation("/")}><ChevronRight className="h-4 w-4 rotate-180" />브랜드 금고</button>}
        </div>

        {page === "vault" ? (
          <VaultView brands={brands} selectedBrand={selectedBrand} activeIdea={activeIdea} onBrand={setSelectedBrandId} onNewBrand={() => setBrandModalOpen(true)} onNewIdea={() => setIdeaModalOpen(true)} onPipeline={openPipeline} />
        ) : null}
        {page === "idea" ? <IdeaView idea={activeIdea} versions={remoteIdea?.versions ?? []} brand={selectedBrand} saving={ideaUpdate.isPending} onPipeline={openPipeline} onRadar={handleRadar} onSave={(draft) => {
          if (selectedIdeaId > 0) {
            ideaUpdate.mutate({ ideaId: selectedIdeaId, ...draft, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) });
          } else {
            toast.message("미리보기 아이디어입니다. 로그인 후 생성한 Idea ID에서는 버전 기록이 금고에 저장됩니다.");
          }
        }} /> : null}
        {page === "radar" ? <RadarView cards={radarCards} sources={radarSources} summary={radarSummary} loading={radarAnalyze.isPending} onAnalyze={handleRadar} /> : null}
        {page === "handfont" ? <HandfontView preview={fontPreview} result={fontResult} uploading={fontUpload.isPending} onFile={handleFontFile} /> : null}
        {page === "format" ? <FormatView name={formatName} extension={extension} mimeType={mimeType} schemaText={schemaText} result={formatResult} generating={formatGenerate.isPending} onName={setFormatName} onExtension={setExtension} onMime={setMimeType} onSchema={setSchemaText} onGenerate={handleFormatGenerate} /> : null}
        {page === "license" ? <LicenseView state={license} result={licenseResult} publicPath={releasePath} generating={licenseGenerate.isPending} onChange={(key, value) => setLicense((current) => ({ ...current, [key]: value }))} onGenerate={handleLicenseGenerate} /> : null}
      </div>

      {brandModalOpen ? <BrandModal pending={brandCreate.isPending} onClose={() => setBrandModalOpen(false)} onCreate={(payload) => brandCreate.mutate(payload)} /> : null}
      {ideaModalOpen ? <IdeaModal brand={selectedBrand} pending={ideaCreate.isPending} onClose={() => setIdeaModalOpen(false)} onCreate={(payload) => {
        if (selectedBrand.id < 0) { toast.error("실제 Idea ID를 기록하려면 로그인 후 브랜드 금고를 먼저 만들어 주세요."); return; }
        ideaCreate.mutate({ ...payload, brandId: selectedBrand.id });
      }} /> : null}
    </DashboardLayout>
  );
}

function VaultView({ brands, selectedBrand, activeIdea, onBrand, onNewBrand, onNewIdea, onPipeline }: { brands: BrandPreview[]; selectedBrand: BrandPreview; activeIdea: IdeaDisplay; onBrand: (id: number) => void; onNewBrand: () => void; onNewIdea: () => void; onPipeline: (target: "font" | "format" | "radar") => void }) {
  return <>
    <section className="origin-stat-grid" aria-label="자산 현황">
      <div className="origin-stat"><b className="origin-stat-value">{brands.length}</b><span className="origin-stat-label">활성 브랜드 금고</span></div>
      <div className="origin-stat"><b className="origin-stat-value">{brands.reduce((sum, brand) => sum + brand.ideaCount, 0)}</b><span className="origin-stat-label">보관된 Idea ID</span></div>
      <div className="origin-stat"><b className="origin-stat-value">08</b><span className="origin-stat-label">제작된 창작 결과물</span></div>
      <div className="origin-stat"><b className="origin-stat-value">03</b><span className="origin-stat-label">추적 중인 레이더</span></div>
    </section>
    <section>
      <div className="origin-section-header"><h2 className="origin-section-title">브랜드 금고</h2><span className="origin-section-caption">서로의 문맥은 기본적으로 분리됩니다.</span></div>
      <div className="origin-vault-grid">
        {brands.map((brand) => <button type="button" key={brand.id} onClick={() => onBrand(brand.id)} className={cn("origin-vault-card", brand.id === selectedBrand.id && "ring-1 ring-stone-400")} style={{ "--vault-color": brand.color } as React.CSSProperties}>
          <i className="origin-vault-line" /><strong>{brand.name}</strong><span>{brand.description || brand.tone}</span><small>{String(brand.ideaCount).padStart(2, "0")} IDEA IDs</small><i className="origin-vault-orb" />
        </button>)}
        <button type="button" className="origin-new-vault" onClick={onNewBrand}><span className="origin-new-vault-content"><i className="origin-plus">+</i>새 브랜드 금고</span></button>
      </div>
    </section>
    <section className="origin-idea-section">
      <article className="origin-idea-card">
        <div className="origin-idea-card-top"><span className="origin-chip"><Fingerprint className="h-3 w-3" />IDEA ID / V.01</span><span className="origin-hash">SHA-256 · {activeIdea.contentHash}</span></div>
        <h2 className="origin-idea-title">{activeIdea.title}</h2>
        <p className="origin-idea-text">{activeIdea.description || activeIdea.originalText}</p>
        <div className="origin-tag-row">{activeIdea.tags.map((tag) => <span key={tag} className="origin-tag">#{tag}</span>)}</div>
        <div className="origin-pipeline">
          <button className="origin-pipeline-button" onClick={() => onPipeline("font")}><span>폰트 만들기</span><PenLine className="h-3.5 w-3.5" /></button>
          <button className="origin-pipeline-button" onClick={() => onPipeline("format")}><span>포맷 만들기</span><FileText className="h-3.5 w-3.5" /></button>
          <button className="origin-pipeline-button" onClick={() => onPipeline("radar")}><span>유사성 검색</span><Radar className="h-3.5 w-3.5" /></button>
        </div>
      </article>
      <aside className="origin-protocol-card">
        <p className="origin-protocol-kicker">EVIDENCE TIMELINE</p><h3>원본의 변화는<br />사라지지 않습니다.</h3><p>수정할 때마다 해시와 변경 요약이 새 버전으로 남습니다.</p>
        <div className="origin-timeline"><div className="origin-timeline-row"><i className="origin-timeline-dot" /><div><strong>v.01 · 원본 기록</strong><span>{formatDate(activeIdea.createdAt)} · SHA-256</span></div></div><div className="origin-timeline-row"><i className="origin-timeline-dot" /><div><strong>다음 버전을 기다리는 중</strong><span>변경 요약을 남길 수 있습니다.</span></div></div></div>
      </aside>
    </section>
    <div className="mt-4 flex justify-end"><button className="origin-quiet-button" onClick={onNewIdea}>새 Idea ID 기록 <ArrowRight className="h-3.5 w-3.5" /></button></div>
  </>;
}

function IdeaView({ idea, versions, brand, saving, onPipeline, onRadar, onSave }: { idea: IdeaDisplay; versions: Array<{ id: number; versionNumber: number; contentHash: string; changeSummary: string; createdAt: Date | string }>; brand: BrandPreview; saving: boolean; onPipeline: (target: "font" | "format" | "radar") => void; onRadar: () => void; onSave: (draft: { title: string; originalText: string; description: string; tags: string; changeSummary: string }) => void }) {
  const [draft, setDraft] = useState({ title: idea.title, originalText: idea.originalText, description: idea.description ?? "", tags: idea.tags.join(", "), changeSummary: "아이디어 내용을 정제했습니다." });
  useEffect(() => setDraft({ title: idea.title, originalText: idea.originalText, description: idea.description ?? "", tags: idea.tags.join(", "), changeSummary: "아이디어 내용을 정제했습니다." }), [idea.id]);
  return <div className="origin-workspace"><article className="origin-tool-card"><div className="origin-idea-card-top"><span className="origin-chip"><Fingerprint className="h-3 w-3" />IDEA ID / ORIGINAL</span><span className="origin-hash">{idea.contentHash}</span></div><div className="origin-form-grid mt-6"><div className="origin-form-field full"><label>아이디어 제목</label><input className="origin-input" value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} /></div><div className="origin-form-field full"><label>설명</label><textarea className="origin-textarea min-h-20" value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} /></div><div className="origin-form-field full"><label>원본 텍스트</label><textarea className="origin-textarea" value={draft.originalText} onChange={(e) => setDraft((current) => ({ ...current, originalText: e.target.value }))} aria-label="원본 텍스트" /></div><div className="origin-form-field"><label>태그</label><input className="origin-input" value={draft.tags} onChange={(e) => setDraft((current) => ({ ...current, tags: e.target.value }))} /></div><div className="origin-form-field"><label>변경 요약</label><input className="origin-input" value={draft.changeSummary} onChange={(e) => setDraft((current) => ({ ...current, changeSummary: e.target.value }))} /></div></div><div className="origin-tool-actions"><span className="origin-tool-note">저장할 때마다 콘텐츠 해시와 변경 요약이 새 증거 버전으로 기록됩니다.</span><button className="origin-primary-button" onClick={() => onSave(draft)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}{saving ? "기록 중" : "새 버전 기록"}</button></div><div className="origin-pipeline"><button className="origin-pipeline-button" onClick={() => onPipeline("font")}>폰트 만들기 <PenLine className="h-3.5 w-3.5" /></button><button className="origin-pipeline-button" onClick={() => onPipeline("format")}>포맷 만들기 <FileText className="h-3.5 w-3.5" /></button><button className="origin-pipeline-button" onClick={onRadar}>유사성 검색 <Radar className="h-3.5 w-3.5" /></button></div></article><EvidencePanel brand={brand} versions={versions} /></div>;
}

function EvidencePanel({ brand, versions }: { brand: BrandPreview; versions: Array<{ id: number; versionNumber: number; contentHash: string; changeSummary: string; createdAt: Date | string }> }) { const timeline = versions.length ? versions.slice(0, 3) : [{ id: 0, versionNumber: 1, contentHash: "미리보기", changeSummary: "원본 아이디어를 기록했습니다.", createdAt: new Date() }]; return <aside className="origin-side-note"><p className="origin-eyebrow">EVIDENCE TIMELINE</p><h3>{brand.name}의 원본 기록</h3><p>원본과 수정본을 함께 보관하고, 생성 시점과 해시로 연결합니다.</p><div className="origin-side-list">{timeline.map((version) => <div key={version.id}><i /><span><b>v.{String(version.versionNumber).padStart(2, "0")}</b> · {version.changeSummary}<br /><small>{formatDate(version.createdAt)} · {version.contentHash.slice(0, 12)}</small></span></div>)}<div><i /><span><b>PRIVATE</b><br />브랜드 금고 밖으로 공개되지 않습니다.</span></div></div></aside>; }

function RadarView({ cards, sources, summary, loading, onAnalyze }: { cards: typeof initialRadar; sources: Array<{ title: string; url: string; kind: string }>; summary: string; loading: boolean; onAnalyze: () => void }) { return <div className="origin-workspace"><article className="origin-tool-card"><div className="flex items-start justify-between gap-4"><div><h2 className="origin-tool-title">Novelty Radar</h2><p className="origin-tool-description">{summary}</p></div><button className="origin-primary-button shrink-0" onClick={onAnalyze} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? "분석 중" : "다시 분석"}</button></div><div className="origin-radar-grid">{cards.map((card) => <article className="origin-radar-card" key={card.label} style={{ "--radar-color": card.color } as React.CSSProperties}><span className="origin-radar-label">{card.label}</span><h4>{card.title}</h4><p>{card.text}</p><div className="origin-radar-action">{card.action}</div></article>)}</div>{sources.length ? <div className="origin-radar-sources">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.kind} · {source.title}<ArrowRight className="h-3 w-3" /></a>)}</div> : null}<p className="origin-disclaimer">Novelty Radar는 LLM 기반의 탐색 보조 도구이며 GitHub 공개 검색 결과를 함께 반영할 수 있습니다. 실제 웹·GitHub·네이밍 권리의 최종 확인과 법적 판단은 공식 데이터베이스 및 전문가 검토가 필요합니다.</p></article><aside className="origin-side-note"><p className="origin-eyebrow">ANALYSIS LENS</p><h3>네 가지 관점</h3><div className="origin-side-list"><div><i /><span>웹 제품과 서비스 구조</span></div><div><i /><span>GitHub 공개 검색 근거</span></div><div><i /><span>이름·표현의 충돌 가능성</span></div><div><i /><span>차별화할 수 있는 빈 공간</span></div></div></aside></div>; }

function HandfontView({ preview, result, uploading, onFile }: { preview: string | null; result: { fontName: string; ttfUrl: string; woff2Url: string; glyphs: string[]; glyphPreviews: string[] } | null; uploading: boolean; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const glyphs = result?.glyphs ?? ["가", "나", "다", "라", "A", "a", "1", "2", "3"];
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  useEffect(() => {
    if (!result) { setFontFamily(null); return; }
    const family = `OriginPreview-${result.fontName.replace(/[^a-z0-9]/gi, "")}-${Date.now()}`;
    const face = new FontFace(family, `url(${result.woff2Url}) format('woff2')`);
    let cancelled = false;
    face.load().then((loaded) => { if (!cancelled) { document.fonts.add(loaded); setFontFamily(family); } }).catch(() => setFontFamily(null));
    return () => { cancelled = true; document.fonts.delete(face); };
  }, [result]);
  return <div className="origin-workspace"><article className="origin-tool-card"><h2 className="origin-tool-title">Handfont Lab</h2><p className="origin-tool-description">글자 시트를 올리면 윤곽을 벡터화해 글리프를 만들고, 조합 미리보기와 설치 가능한 폰트 파일까지 한 흐름으로 이어갑니다.</p><label className="origin-upload-zone">{preview ? <img src={preview} alt="업로드한 손글씨 시트" /> : null}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} /><div className="origin-upload-copy"><i className="origin-upload-icon">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</i><strong>{uploading ? "글리프를 벡터화하는 중" : result ? `${result.fontName} 준비 완료` : preview ? "손글씨 시트를 확인했습니다" : "손글씨 시트를 올려주세요"}</strong><span>PNG · JPG · WEBP · 최대 5MB<br />권장: 선명한 흰 배경의 글자 칸</span></div></label><div className="origin-section-header mt-6"><h3 className="origin-section-title">Glyph separation</h3><span className="origin-section-caption">실제 벡터 글리프</span></div><div className="origin-glyph-strip">{glyphs.map((glyph, index) => <span className="origin-glyph" key={glyph}>{result?.glyphPreviews[index] ? <img className="origin-glyph-preview" src={result.glyphPreviews[index]} alt={`${glyph} 글리프 벡터 미리보기`} /> : glyph}</span>)}</div><div className="origin-font-preview"><span>생성 폰트 조합</span><p style={fontFamily ? { fontFamily } : undefined}>가나다라 Aa123</p></div><div className="origin-tool-actions"><span className="origin-tool-note">{result ? "실제 글리프 윤곽과 생성 WOFF2를 적용해 조합을 미리 봅니다." : "업로드 후 TTF / WOFF2 결과물을 생성합니다."}</span>{result ? <span className="flex gap-2"><a className="origin-secondary-button" href={result.ttfUrl} download><Download className="h-4 w-4" />TTF</a><a className="origin-secondary-button" href={result.woff2Url} download><Download className="h-4 w-4" />WOFF2</a></span> : <button className="origin-secondary-button" disabled><Download className="h-4 w-4" />폰트 내보내기</button>}</div></article><aside className="origin-side-note"><p className="origin-eyebrow">FONT WORKFLOW</p><h3>손글씨를 폰트로</h3><div className="origin-side-list"><div><i /><span>업로드 원본의 어두운 획을 추적해 벡터 윤곽으로 바꿉니다.</span></div><div><i /><span>각 글자 칸의 윤곽을 개별 글리프로 적용해 조합을 검수합니다.</span></div><div><i /><span>웹용 WOFF2와 설치용 TTF로 바로 내보냅니다.</span></div></div></aside></div>;
}

function FormatView({ name, extension, mimeType, schemaText, result, generating, onName, onExtension, onMime, onSchema, onGenerate }: { name: string; extension: string; mimeType: string; schemaText: string; result: ReturnType<typeof createFormatFiles> | null; generating: boolean; onName: (value: string) => void; onExtension: (value: string) => void; onMime: (value: string) => void; onSchema: (value: string) => void; onGenerate: () => void }) { return <div className="origin-workspace"><article className="origin-tool-card"><h2 className="origin-tool-title">Format Forge</h2><p className="origin-tool-description">확장자, MIME 타입, 스키마를 정의하면 사람이 읽는 명세와 개발자가 바로 쓸 수 있는 SDK를 만듭니다.</p><div className="origin-form-grid"><div className="origin-form-field"><label>포맷 이름</label><input className="origin-input" value={name} onChange={(e) => onName(e.target.value)} /></div><div className="origin-form-field"><label>확장자명</label><input className="origin-input" value={extension} onChange={(e) => onExtension(e.target.value)} placeholder="idea" /></div><div className="origin-form-field full"><label>MIME 타입</label><input className="origin-input" value={mimeType} onChange={(e) => onMime(e.target.value)} /></div><div className="origin-form-field full"><label>필드 스키마 (JSON)</label><textarea className="origin-textarea font-mono text-[11px]" value={schemaText} onChange={(e) => onSchema(e.target.value)} /></div></div><div className="origin-tool-actions"><span className="origin-tool-note">JSON 기반 · Version 1.0.0 · TypeScript / Python SDK</span><button className="origin-primary-button" onClick={onGenerate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}{generating ? "생성 중" : "명세서 만들기"}</button></div>{result ? <div className="mt-6"><div className="origin-section-header"><h3 className="origin-section-title">.{result.safe} 준비 완료</h3><div className="flex gap-2"><button className="origin-secondary-button" onClick={() => downloadText(`${result.safe}.md`, result.spec, "text/markdown;charset=utf-8")}>명세서</button><button className="origin-secondary-button" onClick={() => downloadText(`${result.safe}.ts`, result.ts, "text/typescript;charset=utf-8")}>TS SDK</button><button className="origin-secondary-button" onClick={() => downloadText(`${result.safe}.py`, result.py, "text/x-python;charset=utf-8")}>Python SDK</button></div></div><pre className="origin-code">{result.ts}</pre></div> : null}</article><aside className="origin-side-note"><p className="origin-eyebrow">FORMAT ANATOMY</p><h3>파일 자체를 브랜드 자산으로</h3><div className="origin-side-list"><div><i /><span>확장자와 MIME 타입으로 파일의 정체성을 만듭니다.</span></div><div><i /><span>스키마가 버전 호환과 유효성 검증의 기준이 됩니다.</span></div><div><i /><span>동일한 명세를 SDK와 문서로 배포합니다.</span></div></div></aside></div>; }

function LicenseView({ state, result, publicPath, generating, onChange, onGenerate }: { state: { personal: boolean; commercial: boolean; attribution: boolean; assetName: string }; result: string | null; publicPath: string | null; generating: boolean; onChange: (key: "personal" | "commercial" | "attribution" | "assetName", value: boolean | string) => void; onGenerate: () => void }) { return <div className="origin-workspace"><article className="origin-tool-card"><h2 className="origin-tool-title">자산 라이선스 빌더</h2><p className="origin-tool-description">폰트·포맷·템플릿의 배포 조건을 고르고, LICENSE 문서와 공개 배포 초안을 함께 만듭니다.</p><div className="origin-form-field mb-4"><label>자산 이름</label><input className="origin-input" value={state.assetName} onChange={(e) => onChange("assetName", e.target.value)} /></div><div className="origin-license-options"><CheckRow title="개인용 이용 허용" description="비상업적 개인 사용을 허용합니다." checked={state.personal} onChange={(value) => onChange("personal", value)} /><CheckRow title="상업용 이용 허용" description="상업 프로젝트 내 사용을 허용합니다." checked={state.commercial} onChange={(value) => onChange("commercial", value)} /><CheckRow title="귀속 표기 조건" description="이용 시 원작자 표기를 요구합니다." checked={state.attribution} onChange={(value) => onChange("attribution", value)} /></div><div className="origin-tool-actions"><span className="origin-tool-note">법률 자문을 대체하지 않습니다. 배포 전 관할 요건을 검토하세요.</span><button className="origin-primary-button" onClick={onGenerate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{generating ? "생성 중" : "LICENSE 만들기"}</button></div>{result ? <div className="mt-6"><div className="origin-section-header"><h3 className="origin-section-title">배포 문서 준비 완료</h3><div className="flex gap-2"><button className="origin-secondary-button" onClick={() => downloadText("LICENSE", result)}>다운로드</button>{publicPath ? <button className="origin-secondary-button" onClick={() => window.open(publicPath, "_blank", "noopener,noreferrer")}>공개 배포 페이지</button> : null}</div></div><pre className="origin-code">{result}</pre></div> : null}</article><aside className="origin-side-note"><p className="origin-eyebrow">RELEASE CONDITIONS</p><h3>배포 조건도 창작의 일부입니다.</h3><div className="origin-side-list"><div><i /><span>선택한 조건은 LICENSE에 즉시 반영됩니다.</span></div><div><i /><span>결과물별로 서로 다른 배포 원칙을 둘 수 있습니다.</span></div><div><i /><span>공개 페이지에는 검토된 조건만 노출하세요.</span></div></div></aside></div>; }

function CheckRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="origin-check-row"><div><strong>{title}</strong><span>{description}</span></div><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>; }

function BrandModal({ pending, onClose, onCreate }: { pending: boolean; onClose: () => void; onCreate: (payload: { name: string; color: string; tone: string; description?: string }) => void }) { const [name, setName] = useState(""); const [tone, setTone] = useState("Quiet confidence"); const [description, setDescription] = useState(""); const [color, setColor] = useState("#A16745"); return <div className="origin-modal-backdrop" role="dialog" aria-modal="true"><form className="origin-modal" onSubmit={(e) => { e.preventDefault(); onCreate({ name, tone, description, color }); }}><div className="origin-modal-top"><div><h3>브랜드 금고 만들기</h3><p>새 브랜드의 원본·검색·결과물은 독립된 공간에서 관리됩니다.</p></div><button type="button" className="origin-icon-button" onClick={onClose}><X className="h-4 w-4" /></button></div><div className="origin-form-grid"><div className="origin-form-field full"><label>브랜드 이름</label><input className="origin-input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="예: NULY" /></div><div className="origin-form-field"><label>브랜드 컬러</label><input className="origin-input h-10 p-1" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div><div className="origin-form-field"><label>톤</label><input className="origin-input" value={tone} onChange={(e) => setTone(e.target.value)} required /></div><div className="origin-form-field full"><label>설명</label><textarea className="origin-textarea min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 브랜드만의 세계를 간단히 기록하세요." /></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" className="origin-secondary-button" onClick={onClose}>취소</button><button className="origin-primary-button" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}금고 만들기</button></div></form></div>; }

function IdeaModal({ brand, pending, onClose, onCreate }: { brand: BrandPreview; pending: boolean; onClose: () => void; onCreate: (payload: { title: string; originalText: string; description?: string; sourceUrl?: string; tags: string[] }) => void }) { const [title, setTitle] = useState(""); const [originalText, setOriginalText] = useState(""); const [description, setDescription] = useState(""); const [tags, setTags] = useState(""); const [sourceUrl, setSourceUrl] = useState(""); const [pasteStatus, setPasteStatus] = useState("텍스트를 붙여넣으면 제목·설명·태그를 자동으로 채웁니다."); const fillFromPaste = (raw: string) => { const parsed = parseIdeaPaste(raw); setTitle(parsed.title); setOriginalText(parsed.originalText); setDescription(parsed.description); setTags(tagsToText(parsed.tags)); setSourceUrl(parsed.sourceUrl ?? ""); setPasteStatus(parsed.sourceUrl ? `출처 URL도 감지했습니다 · ${parsed.sourceUrl}` : "붙여넣은 텍스트를 Idea ID 필드로 나눴습니다."); }; const handleClipboard = async () => { try { fillFromPaste(await navigator.clipboard.readText()); } catch { setPasteStatus("브라우저 권한으로 읽을 수 없습니다. 아래 원본 텍스트 칸에 직접 붙여넣어 주세요."); } }; return <div className="origin-modal-backdrop" role="dialog" aria-modal="true"><form className="origin-modal" onSubmit={(e) => { e.preventDefault(); onCreate({ title, originalText, description, sourceUrl: sourceUrl || undefined, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }); }}><div className="origin-modal-top"><div><h3>새 Idea ID 기록</h3><p>{brand.name} 금고에 원본과 첫 번째 증거 버전을 만듭니다.</p></div><button type="button" className="origin-icon-button" onClick={onClose}><X className="h-4 w-4" /></button></div><div className="origin-paste-box"><div><span className="origin-eyebrow">PASTE TO IDEA ID</span><strong>복붙하면 자동으로 넣어집니다</strong><p>{pasteStatus}</p></div><button type="button" className="origin-secondary-button" onClick={handleClipboard}><Clipboard className="h-4 w-4" />클립보드 가져오기</button></div><div className="origin-form-grid"><div className="origin-form-field full"><label>제목</label><input className="origin-input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} /></div><div className="origin-form-field full"><label>원본 텍스트 <span className="origin-field-hint">여기에 붙여넣어도 자동 분류됩니다</span></label><textarea className="origin-textarea" value={originalText} onPaste={(event) => { const text = event.clipboardData.getData("text"); if (text.trim()) { event.preventDefault(); fillFromPaste(text); } }} onChange={(e) => setOriginalText(e.target.value)} required minLength={8} /></div><div className="origin-form-field full"><label>설명 (선택)</label><textarea className="origin-textarea min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} /></div><div className="origin-form-field full"><label>태그 (쉼표로 구분)</label><input className="origin-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="font, format, creator-tool" /></div>{sourceUrl ? <div className="origin-form-field full"><label>감지한 출처</label><input className="origin-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /></div> : null}</div><div className="mt-5 flex justify-end gap-2"><button type="button" className="origin-secondary-button" onClick={onClose}>취소</button><button className="origin-primary-button" disabled={pending || originalText.trim().length < 8}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}원본 잠그기</button></div></form></div>; }

function radarColor(label: string) { return ({ "이미 있음": "#9F684B", "가까움": "#657B76", "비어 있음": "#7287A2", "주의": "#8E6874" } as Record<string, string>)[label] ?? "#9F684B"; }
