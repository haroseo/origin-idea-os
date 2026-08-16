# Origin Idea OS

Origin은 창작자의 아이디어와 결과물을 브랜드 단위로 분리해 기록하고, 검증하고, 배포하는 풀스택 크리에이티브 자산 관리 플랫폼입니다.

## 주요 흐름

브랜드 금고(Brand Vault)에서 브랜드별 공간을 만들고, Idea ID에 원본 텍스트·설명·태그·해시·버전 타임라인을 남깁니다. Novelty Radar는 LLM 분석과 공개 GitHub 검색 근거를 결합해 유사성 검토를 보조합니다. Handfont Lab은 3×3 손글씨 시트를 글리프로 분리해 벡터화하고 TTF·WOFF2를 생성합니다. Format Forge는 확장자·MIME·JSON 스키마로 명세서와 TypeScript/Python SDK를 만듭니다. 라이선스 빌더는 배포 조건과 공개 페이지를 생성합니다.

Idea ID 생성 모달에서는 텍스트를 직접 붙여넣거나 **클립보드 가져오기**를 누르면 제목·설명·해시태그·출처 URL을 자동 분류합니다. 출처 URL은 `ideas.sourceUrl`에 저장됩니다.

## 요구 환경

| 항목 | 버전 |
| --- | --- |
| Node.js | 22.13.0 이상 |
| npm | 10.9.2 이상 |
| pnpm | 10.4.1 |
| 앱 | React 19 + Vite 7 + Express 4 + tRPC 11 |

`.nvmrc`를 지원하는 환경에서는 `nvm use`로 Node 버전을 맞출 수 있습니다. 패키지 설치는 `pnpm install`을 권장하며, npm을 사용하는 환경에서는 `corepack enable` 후 pnpm을 활성화하면 lockfile과 동일하게 설치됩니다.

## 로컬 실행

```bash
corepack enable
pnpm install
pnpm run dev
```

개발 서버는 환경에 주입된 포트에서 실행됩니다. 운영 빌드와 실행은 다음과 같습니다.

```bash
pnpm run build
pnpm run start
```

## 품질 검사

다음 명령은 TypeScript 검사, Vitest 테스트, Vite 및 Express 운영 번들을 순서대로 실행합니다.

```bash
pnpm run verify
```

npm 스크립트 호환성도 유지되어 `npm run check`, `npm run test`, `npm run build`를 사용할 수 있습니다. 현재 프로젝트는 npm 라이브러리 패키지가 아니라 서버가 포함된 애플리케이션이므로 `npm publish` 대상이 아닙니다.

## GitHub Actions

`.github/workflows/ci.yml`은 `main` push와 pull request마다 Node 22.13.0과 pnpm 10.4.1을 사용해 의존성 설치, TypeScript 검사, Vitest, Vite 운영 빌드를 자동 실행합니다. CI에는 비밀 키가 필요한 통합 호출을 넣지 않았으며, 운영 환경 변수는 배포 환경에서 주입해야 합니다.

## 환경 변수와 데이터베이스

Manus WebDev 환경은 OAuth, 데이터베이스, 스토리지 관련 시스템 변수를 제공합니다. 로컬에서 필요한 환경 변수는 배포 환경의 설정을 기준으로 구성해야 하며, `.env`와 토큰은 저장소에 커밋하지 않습니다. 스키마 변경은 `drizzle/schema.ts`를 먼저 수정한 뒤 Drizzle migration을 생성하고 적용합니다.

## 라이선스

MIT. 외부 서비스, 폰트 엔진, 이미지 처리 라이브러리의 각 라이선스는 배포 전에 해당 패키지의 고지 사항을 확인해야 합니다.
