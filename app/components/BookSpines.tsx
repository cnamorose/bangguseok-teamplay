// 인증 화면(로그인·회원가입) 머리에 놓는 책등 몇 권.
//
// 예전엔 나무 선반이 그려진 큰 책장 배경이었는데, 지금 테마는 면과 선으로만
// 말하므로 정체성만 남기고 덜어냈다. 색은 --book-1~6을 쓰므로 테마를 따라간다.

const SPINES = [
  { color: "book-1", height: 26 },
  { color: "book-3", height: 34 },
  { color: "book-2", height: 22 },
  { color: "book-5", height: 30 },
  { color: "book-4", height: 34 },
  { color: "book-6", height: 24 },
];

export default function BookSpines() {
  return (
    <div className="ui-spines" aria-hidden="true">
      {SPINES.map((s, i) => (
        <span key={i} style={{ height: s.height, background: `var(--${s.color})` }} />
      ))}
    </div>
  );
}
