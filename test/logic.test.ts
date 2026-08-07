import { describe, expect, it } from "vitest";
import { classify, buildMinwonText, triageMarkdown } from "../src/logic.js";
import { CHANNELS, CATEGORIES } from "../src/data.js";

describe("classify", () => {
  it("키워드 없는 생활불편은 일반민원", () => {
    const r = classify("윗집이 새벽마다 인테리어 공사해서 잠을 못 잔다");
    expect(r.category).toBe("일반민원");
    expect(r.lawHints.some((h) => h.theme === "소음")).toBe(true);
  });

  it("공무원 뇌물은 부패신고", () => {
    expect(classify("구청 공무원이 업체한테 뇌물 받는 걸 봤다").category).toBe("부패신고");
  });

  it("식당 위생 문제는 공익신고", () => {
    expect(classify("동네 식당이 유통기한 지난 재료를 쓴다").category).toBe("공익신고");
  });

  it("영업정지 불복은 행정심판", () => {
    expect(classify("영업정지 처분이 억울해서 불복하고 싶다").category).toBe("행정심판");
  });
});

describe("buildMinwonText", () => {
  it("제목·경위·요구·법령·증빙이 모두 들어간다", () => {
    const text = buildMinwonText({
      category: "일반민원",
      title: "소음 단속 요청",
      recipient: "OO구청",
      incident: "새벽마다 공사 소음이 발생하고 있습니다.",
      request: "1. 단속을 요청합니다.",
      legalBasis: ["소음·진동관리법"],
      evidence: ["녹음 파일"],
    });
    expect(text).toContain("[제목] 소음 단속 요청");
    expect(text).toContain("[피신청기관] OO구청");
    expect(text).toContain("[관련 법령] 소음·진동관리법");
    expect(text).toContain("- 녹음 파일");
  });
});

describe("데이터 정합성", () => {
  it("모든 카테고리에 접수처가 있다", () => {
    for (const c of CATEGORIES) {
      expect(CHANNELS[c].url).toMatch(/^https:\/\//);
      expect(CHANNELS[c].제출단계.length).toBeGreaterThan(2);
    }
  });

  it("triage 마크다운에 접수처와 역질문이 포함된다", () => {
    const r = classify("쓰레기 무단투기가 심하다");
    const md = triageMarkdown("쓰레기 무단투기가 심하다", r);
    expect(md).toContain("접수처");
    expect(md).toContain("사용자에게 확인할 것");
  });
});
