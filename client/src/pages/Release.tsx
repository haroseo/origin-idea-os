import { trpc } from "@/lib/trpc";
import { Download, FileKey2, Loader2, ShieldCheck } from "lucide-react";
import { useRoute } from "wouter";

function downloadLicense(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9-_]/g, "-")}-LICENSE`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Release() {
  const [, params] = useRoute("/release/:assetId");
  const assetId = Number(params?.assetId);
  const release = trpc.origin.release.get.useQuery({ assetId }, { enabled: Number.isFinite(assetId) && assetId > 0 });

  if (release.isLoading) return <main className="origin-release-page"><div className="origin-release-card"><Loader2 className="h-5 w-5 animate-spin" />배포 문서를 불러오는 중입니다.</div></main>;
  if (!release.data) return <main className="origin-release-page"><div className="origin-release-card"><FileKey2 className="h-7 w-7" /><h1>배포 문서를 찾지 못했습니다.</h1><p>링크가 올바른지 확인해 주세요.</p></div></main>;
  const data = release.data;

  return <main className="origin-release-page"><section className="origin-release-card"><div className="origin-release-seal"><span>O</span></div><p className="origin-eyebrow">ORIGIN / PUBLIC RELEASE</p><h1>{data.name}</h1><p className="origin-release-owner">Issued by {data.ownerName}</p><div className="origin-release-rule" /><div className="origin-release-license">{data.license}</div><button className="origin-primary-button" onClick={() => downloadLicense(data.name, data.license)}><Download className="h-4 w-4" />LICENSE 다운로드</button><p className="origin-release-note"><ShieldCheck className="h-3.5 w-3.5" />Origin에서 발급된 창작 자산 배포 문서</p></section></main>;
}
