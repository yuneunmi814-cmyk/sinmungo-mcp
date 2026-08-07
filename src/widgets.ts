// 카카오 툴즈 위젯 봉투 — legal-navigator-mcp/src/widgets.ts의 확정 스펙(개발가이드 §3)을 트림해 재사용.
// ① 전체를 `widget`으로 감싸기 ② 카톡 공유/복사용은 `copy_text` ③ status 사용 금지
// ④ 버튼 URL은 onClickAction.payload.target.url(+선택 pcUrl) ⑤ 응답은 text에 JSON.stringify.

export type ActionConfig = { type?: string; payload?: Record<string, unknown> };
export interface Title { type: "Title"; value: string; size?: "sm" | "md" | "lg" }
export interface Caption { type: "Caption"; value: string }
export interface TextC { type: "Text"; value: string; size?: string; italic?: boolean }
export interface Badge {
  type: "Badge";
  label: string;
  color?: "secondary" | "success" | "danger" | "warning" | "info" | "discovery";
  variant?: "solid" | "soft" | "outline";
}
export interface Button {
  type: "Button";
  label: string;
  onClickAction: ActionConfig;
  style?: "primary" | "secondary";
  block?: boolean;
}
export interface Divider { type: "Divider" }
export interface Row { type: "Row"; children: WidgetComponent[]; gap?: number }
export type WidgetComponent = Title | Caption | TextC | Badge | Button | Divider | Row;
export interface Card { type: "Card"; children: WidgetComponent[]; size?: "sm" | "md" | "lg" | "full" }
export interface KakaoWidget { widget: Card; copy_text?: string; name?: string }

const openUrl = (url: string): ActionConfig => ({ payload: { target: { url } } });
const trunc = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function kakaoWidgetText(kw: KakaoWidget): string {
  return JSON.stringify(kw);
}

// 완성 민원문 카드 — copy_text에 전문을 담아 '복사 → 신문고 붙여넣기' 흐름을 만든다.
export function buildMinwonWidget(args: {
  category: string;
  title: string;
  siteName: string;
  url: string;
  처리기한: string;
  fullText: string;
}): KakaoWidget {
  const children: WidgetComponent[] = [
    { type: "Caption", value: "✍️ 민원문 작성 완료" },
    { type: "Title", value: trunc(args.title, 44) },
    {
      type: "Row",
      gap: 8,
      children: [
        { type: "Badge", label: args.category, color: "info", variant: "soft" },
        { type: "Badge", label: trunc(`⏰ ${args.처리기한}`, 30), color: "warning", variant: "soft" },
      ],
    },
    { type: "Divider" },
    { type: "Text", value: "이 메시지를 복사한 뒤, 아래 버튼으로 접수처에 로그인해 붙여넣으세요.", size: "sm" },
    {
      type: "Button",
      label: `🏛️ ${args.siteName}에서 제출하기`,
      onClickAction: openUrl(args.url),
      style: "primary",
      block: true,
    },
    { type: "Caption", value: "작성 보조 도구(비공식) · 제출·인증은 본인이 직접 · 신문고 간편민원 도우미" },
  ];
  return {
    widget: { type: "Card", size: "md", children },
    copy_text: args.fullText,
    name: "finalize_minwon",
  };
}

// ── 로컬 근사 미리보기 (팀·데모용) ──
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BADGE_BG: Record<string, string> = {
  secondary: "#eef0f4;color:#4a5164", success: "#e6f5ef;color:#1f8a5f", danger: "#fdeceb;color:#c6423a",
  warning: "#fdf3e2;color:#b07305", info: "#e9f1fd;color:#2b62c9", discovery: "#f2ecfd;color:#7b4dd6",
};

function nodeHtml(c: WidgetComponent): string {
  switch (c.type) {
    case "Title": return `<div class="w-title">${esc(c.value)}</div>`;
    case "Caption": return `<div class="w-cap">${esc(c.value)}</div>`;
    case "Text": return `<div class="w-text">${esc(c.value)}</div>`;
    case "Badge": return `<span class="w-badge" style="background:${BADGE_BG[c.color ?? "secondary"]}">${esc(c.label)}</span>`;
    case "Button": {
      const target = (c.onClickAction.payload as { target?: { url?: string } } | undefined)?.target;
      return `<a class="w-btn ${c.style === "primary" ? "pri" : "sec"}" href="${esc(String(target?.url ?? "#"))}">${esc(c.label)}</a>`;
    }
    case "Divider": return `<hr class="w-div">`;
    case "Row": return `<div class="w-row">${c.children.map(nodeHtml).join("")}</div>`;
  }
}

export function renderWidgetHtml(kw: KakaoWidget, heading: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>위젯 미리보기 · ${esc(heading)}</title>
<style>
body{margin:0;background:#aebdcb;font-family:"Apple SD Gothic Neo",Pretendard,sans-serif;display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px 14px;}
.note{font-size:12px;color:#3d4a57;background:#ffffffaa;border-radius:8px;padding:6px 12px;max-width:360px;text-align:center}
.chat{width:min(94vw,380px)}
.bubble-q{background:#ffe94a;border-radius:14px 14px 3px 14px;padding:9px 13px;font-size:13.5px;margin:0 0 10px auto;width:fit-content;max-width:80%;}
.w-card{background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(0,0,0,.12);padding:16px;display:flex;flex-direction:column;gap:9px;}
.w-title{font-size:16.5px;font-weight:800;color:#1c2230;line-height:1.3}
.w-cap{font-size:11.5px;color:#8a93a3}
.w-text{font-size:13.5px;color:#333c4b;line-height:1.45}
.w-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;display:inline-block}
.w-btn{display:block;text-align:center;font-size:14px;font-weight:700;padding:11px 12px;border-radius:10px;text-decoration:none}
.w-btn.pri{background:#1c2230;color:#fff}
.w-btn.sec{background:#f1f3f6;color:#1c2230}
.w-div{border:none;border-top:1px solid #eceff3;margin:2px 0}
.w-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.copy{width:min(94vw,380px);font-size:11.5px;color:#3d4a57;background:#ffffffaa;border-radius:8px;padding:8px 12px;white-space:pre-wrap}
.copy b{display:block;margin-bottom:3px}
</style></head><body>
<p class="note">⚠️ 로컬 근사 미리보기 — 실제 렌더는 카카오 툴즈 프리뷰에서 확인</p>
<div class="chat">
  <div class="bubble-q">${esc(heading)}</div>
  <div class="w-card">${kw.widget.children.map(nodeHtml).join("")}</div>
</div>
${kw.copy_text ? `<div class="copy"><b>📤 copy_text (복사되는 내용):</b>${esc(kw.copy_text)}</div>` : ""}
</body></html>`;
}
