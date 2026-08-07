// 분류·법령 힌트·완성문 조립 — 순수 함수 (테스트 대상)
import {
  CATEGORIES,
  CATEGORY_KEYWORDS,
  CHANNELS,
  QUESTIONS,
  THEME_LAWS,
  type Category,
} from "./data.js";

export interface TriageResult {
  category: Category;
  candidates: Category[]; // 점수순 후보 (1위 = category)
  lawHints: { theme: string; laws: string[] }[];
}

// 키워드 점수로 분류. 아무것도 안 걸리면 일반민원.
export function classify(situation: string): TriageResult {
  const text = situation.replace(/\s+/g, " ");
  const scores = new Map<Category, number>();
  for (const cat of CATEGORIES) scores.set(cat, 0);

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    for (const kw of keywords) {
      if (text.includes(kw)) scores.set(cat, (scores.get(cat) ?? 0) + 1);
    }
  }

  const ranked = [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);

  const category: Category = ranked[0] ?? "일반민원";
  const candidates = ranked.length ? ranked : ["일반민원" as Category];

  const lawHints = THEME_LAWS.filter((t) => t.keywords.some((k) => text.includes(k))).map(
    ({ theme, laws }) => ({ theme, laws }),
  );

  return { category, candidates, lawHints };
}

export interface MinwonDraft {
  category: Category;
  title: string;
  recipient?: string;
  incident: string;
  request: string;
  legalBasis?: string[];
  evidence?: string[];
}

// 완성문 전문 (복사·붙여넣기용 텍스트)
export function buildMinwonText(d: MinwonDraft): string {
  const lines = [
    `[제목] ${d.title}`,
    "",
    ...(d.recipient ? [`[피신청기관] ${d.recipient}`, ""] : []),
    "[사건 경위]",
    d.incident,
    "",
    "[요구사항]",
    d.request,
  ];
  if (d.legalBasis?.length) lines.push("", `[관련 법령] ${d.legalBasis.join(", ")}`);
  if (d.evidence?.length) lines.push("", "[첨부 증빙]", ...d.evidence.map((e) => `- ${e}`));
  return lines.join("\n");
}

// triage 응답 마크다운
export function triageMarkdown(situation: string, r: TriageResult): string {
  const ch = CHANNELS[r.category];
  const qs = QUESTIONS[r.category];
  const parts = [
    `## 🔎 분류 결과: **${r.category}**`,
    "",
    `- **접수처**: ${ch.siteName} (${ch.url}) — 운영: ${ch.운영기관}`,
    `- **처리기한**: ${ch.처리기한}`,
  ];
  if (r.candidates.length > 1) {
    parts.push(`- 다른 가능성: ${r.candidates.slice(1).join(", ")} — 사안을 더 들어보고 판단하세요.`);
  }
  if (r.lawHints.length) {
    parts.push(
      "",
      "### ⚖️ 관련 법령 힌트",
      ...r.lawHints.map((h) => `- ${h.theme}: ${h.laws.join(", ")}`),
    );
  }
  parts.push(
    "",
    "### ❓ 사용자에게 확인할 것",
    ...qs.map((q) => `- ${q.question} _(${q.hint})_`),
  );
  return parts.join("\n");
}
