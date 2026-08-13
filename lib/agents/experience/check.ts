import { callLLMJson, LLMUsage } from "@/lib/ai";
import { Gap } from "./organize";

// 점검 도우미.
// 사용자가 칸을 고친 뒤, 그 내용이 그 칸에 맞게 들어갔는지 본다.
//
// 칸마다 따로 부르지 않고 한 번에 전체를 본다. "행동 칸에 결과가 섞였다" 같은 판정은
// 두 칸을 같이 봐야 알 수 있어서, 칸별 검사로는 애초에 잡히지 않는다.
//
// 비어 있는 칸은 화면에서 이미 표시하므로 여기서는 다루지 않는다.
// 여기가 볼 것은 '잘못 들어간 것'과 '모호한 것'이다.

export interface CheckInput {
  title: string;
  period?: string | null;
  role?: string | null;
  situation?: string | null;
  action?: string | null;
  impact?: string | null;
  learning?: string | null;
  message?: string | null;
  tags?: string[];
}

const SYSTEM =
  "너는 취업 준비생의 경험 정리를 검토하는 사람이다. " +
  "칸에 들어간 내용이 그 칸의 성격에 맞는지만 본다. " +
  "없는 사실을 만들어 채우라고 요구하지 않고, 이미 적힌 것을 어디로 옮기거나 어떻게 다듬을지만 말한다.";

/** 칸의 정의 — 판정 기준이자 사용자에게 보여줄 설명 */
const FIELD_SPEC = `
STAR로 나뉜 칸이다.
- period: 언제인지 알 수 있어야 한다.
- role (T·과제): 맡은 자리와 목표. "참여", "팀원"처럼 무엇을 책임졌는지 모르면 모호하다.
- situation (S·상황): 어디서 어떤 문제였는지. 규모·맥락이 있으면 좋다.
  해결 행동이 여기 들어오면 안 된다.
- action (A·행동): 직접 한 일. 이 칸이 가장 중요하다.
  · 주어가 '우리·팀'이면 안 된다
  · 결과가 섞이면 안 된다
  · 도구·방법의 이름이 없으면 뭉뚱그린 것이다 ("분석했다"만 있고 무엇으로 했는지 없음)
  · 왜 그 방법을 택했는지가 없으면 아쉽다
- impact (R·결과): 그래서 무엇이 달라졌는지. 행동을 다시 쓴 것이면 안 된다.
  "좋아졌다", "빨라졌다"처럼 전후를 비교할 수 없으면 모호하다.
- learning(배운 점): 이 사람에게 남은 것.
- message(한 줄 메시지): 이 경험이 남에게 보여주는 이 사람의 모습.
  배운 점과 같은 말이면 안 된다. ("~의 중요성을 배웠다"는 배운 점이지 메시지가 아니다)
- tags(키워드): 내용에서 실제로 드러나는 역량이어야 한다.
`.trim();

export async function checkExperience(
  input: CheckInput
): Promise<{ gaps: Gap[]; usage: LLMUsage }> {
  const filled = Object.entries(input)
    .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : String(v ?? "").trim()))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");

  const userPrompt = `
아래는 어떤 사람이 정리한 경험이다. 각 칸의 내용이 그 칸에 맞게 들어갔는지 검토해라.

[칸의 정의]
${FIELD_SPEC}

[정리된 내용]
${filled}

[검토 규칙]
- **비어 있는 칸은 지적하지 마라.** 그건 화면에서 이미 표시한다.
- 적힌 내용만 보고 판단해라. 없는 사실을 채우라고 하지 마라.
- 우선순위: ① 다른 칸에 들어갈 내용이 섞임 ② 전후 비교가 안 되는 모호한 표현
  ③ 주어가 '우리' ④ 행동에 도구·방법 이름이 없어 뭉뚱그려짐
- 문제가 없으면 빈 배열을 돌려줘라. 억지로 찾지 마라.
- 최대 3개까지만.

kind는 셋 중 하나다.
- "misplaced": 다른 칸에 들어갈 내용이 여기 있다 (question에 어디로 옮길지 적어라)
- "vague": 뜻은 맞지만 너무 뭉뚱그렸다
- "subject": 주어가 '우리·팀'이라 이 사람이 한 일이 안 보인다

question은 그 사람이 바로 답하거나 바로 고칠 수 있는 문장으로 써라.
  나쁨: "결과가 부적절합니다"
  좋음: "'캐싱을 적용했다'는 한 일에 가까워요. 결과 칸엔 그래서 무엇이 달라졌는지를 적어보세요"

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{
  "gaps": [{ "field": "impact", "kind": "misplaced", "issue": "무엇이 문제인지 짧게", "question": "바로 고칠 수 있는 안내" }]
}
`.trim();

  const { data, usage } = await callLLMJson<{ gaps: Gap[] }>({
    systemPrompt: SYSTEM,
    userPrompt,
  });

  return {
    gaps: Array.isArray(data.gaps) ? data.gaps.slice(0, 3) : [],
    usage,
  };
}
