import { callLLMJson, LLMUsage } from "@/lib/ai";
import { getInterviewer } from "./interviewers";
import { Turn } from "./ask";

// 면접이 끝나고 받는 총평.
//
// 점수를 매기지 않는다. 면접은 상대와 상황에 따라 갈리는 자리라 점수가 오해를 부른다.
// 대신 "질문마다 무엇이 아쉬웠고 어떻게 답했으면 좋았을지"를 준다.

export interface QuestionFeedback {
  question: string;
  good: string;   // 좋았던 점 (없으면 빈 문자열)
  weak: string;   // 아쉬운 점
  better: string; // 이렇게 답했다면
}

export interface InterviewFeedback {
  perQuestion: QuestionFeedback[];
  /** 잘 지킨 것 */
  strengths: string[];
  /** 반복해서 나온 습관 */
  habits: string[];
  /** 다음 면접 전에 준비할 것 */
  todo: string[];
  /** 시간 관련 총평 (길게 말한 답변이 있었는지 등) */
  timing: string;
  /** 답변다운 답변이 하나도 없었던 경우 */
  noAnswer?: boolean;
}

const ZERO_USAGE: LLMUsage = { model: "", inputTokens: 0, outputTokens: 0, cost: 0 };

export async function makeFeedback(
  companyName: string,
  role: string,
  turns: Turn[]
): Promise<{ feedback: InterviewFeedback; usage: LLMUsage }> {
  const answers = turns.filter((t) => t.role === "candidate");
  const valid = answers.filter((t) => !t.invalid);

  // 답변다운 답변이 하나도 없으면 LLM을 부르지 않는다.
  // 물어보면 "간결하게 답하려 한 점이 좋다" 같은 말을 만들어내고,
  // 그 한 줄 때문에 나머지 피드백까지 못 믿게 된다.
  if (valid.length === 0) {
    return {
      feedback: {
        perQuestion: [],
        strengths: [],
        habits: [],
        todo: ["질문에 실제로 답한 뒤 다시 받아보세요. 한 문장이라도 괜찮아요."],
        timing: "",
        noAnswer: true,
      },
      usage: ZERO_USAGE,
    };
  }

  // 질문–답변 쌍으로 묶고, 답변 시간도 함께 넘긴다
  const pairs: string[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role !== "interviewer") continue;
    const answer = turns[i + 1]?.role === "candidate" ? turns[i + 1] : null;
    const answerText = !answer
      ? "(답변 없음)"
      : answer.invalid
        ? `(답변이 아님 — ${answer.invalid})`
        : answer.content;

    pairs.push(
      `Q(${getInterviewer(t.speaker ?? "").name}): ${t.content}\n` +
        `A: ${answerText}` +
        (answer?.seconds && !answer.invalid
          ? `  [작성 ${answer.seconds}초${answer.over ? " · 제한 초과" : ""}]`
          : "")
    );
  }

  const userPrompt = `
"${companyName}" ${role} 직무 면접 연습이 끝났다. 지원자에게 줄 피드백을 정리해라.

[면접 기록]
${pairs.join("\n\n")}

[피드백 규칙]
- 점수를 매기지 마라. 무엇이 아쉬웠고 어떻게 하면 나아지는지만 말해라.
- **"이렇게 답했다면"은 실제 문장으로 써라.** "구체적으로 답하세요" 같은 조언은 쓸모가 없다.
  다만 지원자가 말하지 않은 사실·숫자를 지어내지 마라. 있는 재료를 다시 배치하는 선에서.
- **(답변 없음) 또는 (답변이 아님)으로 표시된 질문은 칭찬거리를 찾지 마라.**
  "간결하게 답하려 했다", "시도한 점이 좋다" 같은 말을 절대 만들어내지 마라.
  답을 안 한 것은 답을 안 한 것이다. weak에 그 사실만 적고 good은 빈 문자열로 둬라.
- strengths는 **실제 답변에서 확인된 것만** 넣어라. 없으면 빈 배열로 두는 게 맞다.
  억지로 채우면 나머지 피드백까지 못 믿게 된다.
- habits에는 여러 답변에서 반복된 습관을 적어라. (예: 결론을 마지막에 말한다, 주어가 '우리'다)
- timing에는 답변 길이·시간에 대한 총평을 한두 문장으로. 자료가 없으면 빈 문자열.

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{
  "perQuestion": [{ "question": "질문 요약", "good": "", "weak": "", "better": "이렇게 답했다면 (실제 문장)" }],
  "strengths": ["잘 지킨 것 1~3개"],
  "habits": ["반복된 습관 1~3개"],
  "todo": ["다음 면접 전에 준비할 것 2~3개"],
  "timing": "한두 문장"
}
`.trim();

  const { data, usage } = await callLLMJson<InterviewFeedback>({
    systemPrompt:
      "너는 면접이 끝난 뒤 지원자를 따로 불러 조언해 주는 면접관이다. " +
      "듣기 좋은 말보다 다음에 실제로 도움이 되는 말을 한다. 없는 사실을 만들지 않는다.",
    userPrompt,
  });

  return {
    feedback: {
      perQuestion: Array.isArray(data.perQuestion) ? data.perQuestion : [],
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      habits: Array.isArray(data.habits) ? data.habits : [],
      todo: Array.isArray(data.todo) ? data.todo : [],
      timing: data.timing ?? "",
    },
    usage,
  };
}
