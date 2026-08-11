import { LLMUsage } from "@/lib/ai";

// 글자수 세기 (기본: 공백 포함, 코드포인트 기준이라 이모지도 1자)
export const countChars = (s: string, includeSpaces = true) =>
  Array.from(includeSpaces ? s : s.replace(/\s/g, "")).length;

// 목표 대비 현재 길이를 알려주는 교정 지시문 (프롬프트에 끼워 넣음)
export function lengthInstruction(cur: number, target: number, tol: number): string {
  const diff = target - cur;
  const dir =
    diff > 0
      ? `약 ${diff}자 분량을 더 늘려라 (예시·부연·설명을 자연스럽게 보태서)`
      : `약 ${-diff}자 분량을 줄여라 (군더더기·중복을 덜어내되 핵심 내용은 유지)`;
  return `현재 글은 공백 포함 ${cur}자다. 목표는 공백 포함 ${target}자(±${tol}자). ${dir}. 주제·논지·구조·형식은 그대로 유지해라.`;
}

/**
 * 측정 → 교정 루프. LLM은 글자수를 못 세므로, 코드로 세서(measure)
 * "지금 몇 자, 목표까지 얼마"를 알려주며 다시 쓰게(revise) 반복한다.
 * 목표 ±tol 안에 들면 멈춘다. (보통 1~2회면 수렴)
 */
export async function fitToLength<T>(opts: {
  target: number;
  tol?: number;
  maxTries?: number;
  initial: T;
  measure: (v: T) => number;
  revise: (v: T, cur: number) => Promise<{ value: T; usage: LLMUsage }>;
  onUsage?: (u: LLMUsage) => void;
}): Promise<T> {
  const tol = opts.tol ?? 50;
  const maxTries = opts.maxTries ?? 3;
  let value = opts.initial;

  for (let i = 0; i < maxTries; i++) {
    const cur = opts.measure(value);
    if (Math.abs(opts.target - cur) <= tol) break;
    const { value: next, usage } = await opts.revise(value, cur);
    value = next;
    opts.onUsage?.(usage);
  }
  return value;
}

// 상한 보장용: 목표를 넘으면 문장 끝(다././!/?)에서 잘라낸다.
// 자를 위치를 못 찾으면(문장부호가 앞쪽에만 있으면) 그냥 목표 길이에서 자른다.
export function trimToSentenceEnd(text: string, maxChars: number): string {
  const arr = Array.from(text);
  if (arr.length <= maxChars) return text;
  const cut = arr.slice(0, maxChars).join("");
  const idx = Math.max(
    cut.lastIndexOf("다."),
    cut.lastIndexOf("."),
    cut.lastIndexOf("!"),
    cut.lastIndexOf("?")
  );
  return idx > maxChars * 0.5 ? cut.slice(0, idx + 1) : cut;
}
