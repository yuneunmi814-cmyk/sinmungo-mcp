import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CATEGORIES, CHANNELS, DRAFTING_GUIDE, type Category } from "./data.js";
import { classify, triageMarkdown, buildMinwonText, type MinwonDraft } from "./logic.js";
import { buildMinwonWidget, renderWidgetHtml, kakaoWidgetText, type KakaoWidget } from "./widgets.js";

// 위젯 스위치 — legalNavi와 동일 규약: 프로덕션 on / 테스트 off, WIDGETS=on|off로 강제.
const widgetsOn = (): boolean =>
  process.env.WIDGETS === "on" || (process.env.WIDGETS !== "off" && process.env.NODE_ENV !== "test");

// PlayMCP 가이드: description에 영문/국문 병기 서비스명 포함
const SVC = "신문고 간편민원 도우미(Sinmungo Minwon Helper)";

const DISCLAIMER =
  "\n\n---\n_비공식 작성 보조 도구입니다(국민권익위원회·국민신문고와 무관). 법률 자문이 아니며, 제출과 본인인증은 이용자가 직접 합니다._";

const SERVER_INSTRUCTIONS =
  "이 서버는 사용자의 러프한 하소연을 대한민국 정식 민원문·신고문으로 다듬는 것을 돕는 작성 보조 도구입니다(비공식 — 국민신문고·국민권익위원회와 무관). " +
  "권장 흐름: ① 사용자가 불편·부당한 일을 이야기하면 minwon_triage로 분류(일반민원/공익신고/부패신고/국민제안/행정심판)·접수처·역질문 목록을 받으세요. " +
  "② 역질문으로 빠진 정보(일시·장소·기존 조치·증거)를 사용자에게 물어 수집하세요. " +
  "③ 수집한 사실로 제목·사건경위(육하원칙, 공문서체)·요구사항을 작성한 뒤 finalize_minwon을 호출해 완성 카드를 만드세요. " +
  "④ 접수 방법을 물으면 get_submit_guide를 호출하세요. " +
  "중요: 사용자가 제공한 사실만 사용하고, 법령 조문 번호를 추측하지 말고, 개별 사안의 법적 판단(승소 가능성 등)은 하지 마세요. " +
  "소송·형사고소가 더 적합해 보이는 중대 사안은 변호사·대한법률구조공단(132) 상담을 함께 안내하세요.";

const READONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function widgetOrText(kw: KakaoWidget, fallbackMd: string): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text: widgetsOn() ? kakaoWidgetText(kw) : fallbackMd }],
  };
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "sinmungo-helper", version: "0.1.0", title: "신문고 간편민원 도우미" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "minwon_triage",
    {
      title: "민원 분류·접수처 진단",
      description:
        "Classifies a Korean citizen's rough complaint into the right petition type (일반민원/공익신고/부패신고/국민제안/행정심판), routes it to the correct government portal (국민신문고 epeople.go.kr, 청렴포털 clean.go.kr, 온라인행정심판 simpan.go.kr), surfaces relevant Korean statutes, and returns the follow-up questions you should ask the user before drafting. ALWAYS call this FIRST when a user describes something unfair, annoying, illegal, or wants to report/complain to a government body.\n" +
        '[트리거 예시] "윗집 공사 소음 미치겠어" / "구청에 민원 넣고 싶어" / "국민신문고에 신고하려면?" / "공무원이 뇌물 받는 걸 봤어" / "영업정지 처분이 억울해"\n' +
        `Service: ${SVC}.`,
      inputSchema: {
        situation: z.string().min(5).describe("사용자가 말한 상황 요약 (러프한 원문 그대로도 OK)"),
      },
      annotations: { title: "민원 분류·접수처 진단", ...READONLY },
    },
    async ({ situation }) => {
      const r = classify(situation);
      const md = [
        triageMarkdown(situation, r),
        "",
        "### 📝 다음 단계 (어시스턴트용)",
        "위 질문으로 정보를 수집한 뒤, 아래 규칙으로 초안을 작성하고 finalize_minwon을 호출하세요:",
        ...DRAFTING_GUIDE.map((g) => `- ${g}`),
      ].join("\n");
      return { content: [{ type: "text", text: md + DISCLAIMER }] };
    },
  );

  server.registerTool(
    "finalize_minwon",
    {
      title: "민원문 완성 카드",
      description:
        "Assembles the drafted Korean petition (title + incident + request) into a finished, copy-ready 민원문 with the correct submission portal button. Call this AFTER minwon_triage and after gathering facts from the user and drafting each section in formal 공문서체. The card's copy text is the full petition — the user copies it and pastes into 국민신문고/청렴포털 themselves.\n" +
        '[트리거 예시] (역질문에 답을 받은 뒤) "이제 민원문 만들어줘" / "완성본 줘"\n' +
        `Service: ${SVC}.`,
      inputSchema: {
        category: z.enum(CATEGORIES).describe("minwon_triage가 정한 분류"),
        title: z.string().min(5).describe("민원 제목 — 간결하고 구체적으로"),
        recipient: z.string().optional().describe("피신청기관 (예: OO구청 환경과). 모르면 생략"),
        incident: z.string().min(20).describe("사건 경위 — 육하원칙, 공문서체, 시간순"),
        request: z.string().min(10).describe("요구사항 — 번호 붙인 구체적 조치"),
        legal_basis: z.array(z.string()).optional().describe("관련 법령 (triage 힌트의 법률명만, 조문 번호 금지)"),
        evidence: z.array(z.string()).optional().describe("첨부 예정 증빙 목록"),
      },
      annotations: { title: "민원문 완성 카드", ...READONLY },
    },
    async ({ category, title, recipient, incident, request, legal_basis, evidence }) => {
      const draft: MinwonDraft = {
        category: category as Category,
        title,
        recipient,
        incident,
        request,
        legalBasis: legal_basis,
        evidence,
      };
      const fullText = buildMinwonText(draft);
      const ch = CHANNELS[category as Category];
      const kw = buildMinwonWidget({
        category,
        title,
        siteName: ch.siteName,
        url: ch.url,
        처리기한: ch.처리기한,
        fullText,
      });
      const fallback = [
        `## ✍️ 완성된 민원문`,
        "",
        "```",
        fullText,
        "```",
        "",
        `**제출**: ${ch.siteName} (${ch.url}) — 위 내용을 복사해 붙여넣고, 본인 인증 후 직접 제출하세요.`,
      ].join("\n") + DISCLAIMER;
      return widgetOrText(kw, fallback);
    },
  );

  server.registerTool(
    "get_submit_guide",
    {
      title: "접수 방법 안내",
      description:
        "Returns the exact step-by-step submission guide for a Korean government petition portal: login methods (간편인증 등), menu path, processing deadline, and cautions — for 국민신문고, 청렴포털(공익·부패신고), 국민제안, 온라인행정심판. Use when the user asks WHERE or HOW to submit, about deadlines, or about 신고자 보호.\n" +
        '[트리거 예시] "이거 어디에 내?" / "국민신문고 접수 방법 알려줘" / "공익신고하면 보호받을 수 있어?" / "처리 기간 얼마나 걸려?"\n' +
        `Service: ${SVC}.`,
      inputSchema: {
        category: z.enum(CATEGORIES).describe("민원 분류"),
      },
      annotations: { title: "접수 방법 안내", ...READONLY },
    },
    async ({ category }) => {
      const ch = CHANNELS[category as Category];
      const md = [
        `## 🏛️ ${category} 접수 방법 — ${ch.siteName}`,
        "",
        `- **사이트**: ${ch.url} (운영: ${ch.운영기관})`,
        `- **로그인**: ${ch.로그인}`,
        `- **처리기한**: ${ch.처리기한}`,
        "",
        "### 제출 단계",
        ...ch.제출단계.map((s, i) => `${i + 1}. ${s}`),
        "",
        "### 주의사항",
        ...ch.주의사항.map((s) => `- ${s}`),
      ].join("\n");
      return { content: [{ type: "text", text: md + DISCLAIMER }] };
    },
  );

  return server;
}

// ── Express 앱 (무상태 Streamable HTTP) ──
export const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "sinmungo-helper-mcp",
    service: SVC,
    tools: ["minwon_triage", "finalize_minwon", "get_submit_guide"],
    note: "비공식 작성 보조 도구 — 국민권익위원회·국민신문고와 무관",
  });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// 위젯 근사 미리보기 (팀·데모용)
app.get("/widgets/minwon", (_req, res) => {
  const ch = CHANNELS["일반민원"];
  const kw = buildMinwonWidget({
    category: "일반민원",
    title: "OO아파트 인접 세대 야간·조기 공사 소음에 대한 단속 및 조치 요청",
    siteName: ch.siteName,
    url: ch.url,
    처리기한: ch.처리기한,
    fullText: buildMinwonText({
      category: "일반민원",
      title: "OO아파트 인접 세대 야간·조기 공사 소음에 대한 단속 및 조치 요청",
      recipient: "관할 구청 환경과",
      incident:
        "민원인은 서울 OO구 OO아파트 101동에 거주하고 있습니다. 2026년 7월 중순부터 인접 세대의 인테리어 공사 소음이 평일 오전 6시경부터 발생하여 일상생활에 상당한 지장을 받고 있습니다.",
      request: "1. 공사 시간 준수 여부 현장 확인 및 지도·단속을 요청합니다.\n2. 처리 결과 회신을 요청합니다.",
      legalBasis: ["소음·진동관리법", "공동주택관리법"],
      evidence: ["소음 발생 일지", "녹음 파일"],
    }),
  });
  res.type("text/html; charset=utf-8").send(renderWidgetHtml(kw, "윗집 공사 소음 민원문 만들어줘"));
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP 요청 처리 오류:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method Not Allowed (stateless: use POST)" },
    id: null,
  });
});

const PORT = Number(process.env.PORT ?? 4300);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.error(`신문고 간편민원 도우미 MCP listening on http://localhost:${PORT}/mcp`);
  });
}
