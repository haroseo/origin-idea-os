export function makeFormatFiles(extension: string, mimeType: string, schema: Record<string, unknown>) {
  const safeExtension = extension.replace(/^\./, "").replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const schemaJson = JSON.stringify(schema, null, 2);
  const variableName = safeExtension.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
  const typeName = safeExtension.replace(/(^|[-_])(\w)/g, (_, __, character) => character.toUpperCase());
  const spec = `# .${safeExtension} Format Specification\n\n- **MIME type:** \`${mimeType}\`\n- **Container:** JSON\n- **Version:** 1.0.0\n\n## Schema\n\n\`\`\`json\n${schemaJson}\n\`\`\`\n`;
  const typeScript = `export const ${variableName}Schema = ${schemaJson} as const;\n\nexport type ${typeName}File = typeof ${variableName}Schema;\n\nexport function parse${typeName}(json: string) {\n  return JSON.parse(json) as ${typeName}File;\n}\n`;
  const python = `import json\nfrom typing import Any\n\nMIME_TYPE = "${mimeType}"\nSCHEMA: dict[str, Any] = ${schemaJson}\n\ndef parse_${safeExtension.replace(/-/g, "_")}(raw: str) -> dict[str, Any]:\n    return json.loads(raw)\n\ndef dump_${safeExtension.replace(/-/g, "_")}(data: dict[str, Any]) -> str:\n    return json.dumps(data, ensure_ascii=False, indent=2)\n`;
  return { safeExtension, spec, typeScript, python };
}

export function makeLicense(input: { assetName: string; personal: boolean; commercial: boolean; attribution: boolean; ownerName: string }) {
  const use = input.personal && input.commercial ? "개인 및 상업적 이용" : input.commercial ? "상업적 이용" : "개인적 이용";
  const attribution = input.attribution ? "이용 시 원작자 표기를 포함해야 합니다." : "원작자 표기는 권장되지만 필수는 아닙니다.";
  return `# ${input.assetName} LICENSE\n\nCopyright (c) ${new Date().getFullYear()} ${input.ownerName}\n\n## 허용 범위\n\n본 자산은 ${use}이 허용됩니다.\n\n## 조건\n\n${attribution}\n원본 파일 또는 파생 결과물을 재배포·판매하기 전에는 별도의 허가를 받아야 합니다.\n\n## 보증의 부인\n\n본 자산은 어떠한 명시적 또는 묵시적 보증 없이 제공됩니다.\n`;
}
