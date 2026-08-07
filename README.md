# 📣 신문고 간편민원 도우미 MCP

카카오 툴즈용 MCP 서버 — 카톡에서 러프하게 하소연하면 AI가 정식 민원문으로 다듬고, **복사 버튼 + 접수처 바로가기 버튼** 카드로 마무리해주는 작성 보조 도구.

> **비공식 도구입니다.** 국민권익위원회·국민신문고와 무관하며, 제출·본인인증은 이용자가 직접 합니다. 서비스명·설명에 "비공식"을 유지하세요 (정부 서비스 사칭 오인 방지 — 등록 심사 리스크).

## 구조

LLM을 직접 호출하지 않는 **무상태 데이터 제공형** 서버입니다 (legal-navigator와 동일 패턴). 초안 작성은 카카오 툴즈의 호스트 AI가 하고, 이 서버는 분류·라우팅·작성 규칙·완성 카드를 제공합니다.

| 툴 | 역할 |
|---|---|
| `minwon_triage` | 키워드 분류(일반민원/공익신고/부패신고/국민제안/행정심판) + 접수처 + 법령 힌트 + 역질문 목록 + 작성 지침 |
| `finalize_minwon` | 호스트 AI가 작성한 초안을 완성 카드로 — `copy_text`=민원문 전문, 버튼=접수처(epeople/clean/simpan) |
| `get_submit_guide` | 접수처별 로그인·제출 단계·처리기한·신고자 보호 안내 |

권장 흐름(서버 instructions에 명시): triage → 역질문으로 정보 수집 → 공문서체 초안 작성 → finalize.

## 실행·검증

```bash
npm install
npm run dev          # http://localhost:4300/mcp (무상태 POST)
npm test             # vitest 7개
npm run typecheck
```

- `GET /healthz` — 헬스체크
- `GET /widgets/minwon` — 완성 카드 로컬 근사 미리보기 (팀·데모용)
- 위젯 스위치: legalNavi와 동일 (`WIDGETS=on|off`, 테스트에서는 기본 off)

## 카카오 툴즈 배포 (legalNavi 때와 동일 절차)

1. GitHub에 레포 push
2. `playmcp.kakaocloud.io/my-mcp` 에서 신규 서버 생성 (Git 소스, main)
3. PlayMCP에 별도 식별자로 등록 (⚠️ 본선작 `legalNaviTools`와 별개 서비스로)
4. 프리뷰(preview-chatgpt.kakao.com)에서 카드 렌더·툴 호출 확인 — 특히 `finalize_minwon`의 copy_text 복사 동작

## 일름보 프로젝트와의 관계

- `~/Downloads/illeumbo` — 웹앱(Claude API 직접 호출) + 크롬 확장(신문고 폼 자동 채움). 독립 서비스 노선.
- 이 레포 — 같은 도메인 로직의 카카오 툴즈 노선. 분류 키워드·접수처 데이터·작성 지침은 `src/data.ts`에 모여 있어 확장·동기화 지점.
