// 화면을 통째로 기다릴 때 쓰는 표시.
//
// 예전엔 "불러오는 중…" 한 줄이 왼쪽 위에 덩그러니 떠서, 로딩인지 에러인지
// 구분이 안 됐다. 가운데에 놓고 움직이게 해서 "기다리는 중"임을 눈으로 알린다.
//
// 모양은 책등이 하나씩 꽂히는 것 — 이 앱이 책장이라서다.

const SPINES = [1, 2, 3, 4, 5];

export default function Loading({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="ui-loading">
      <div className="ui-loading-books" aria-hidden="true">
        {SPINES.map((i) => (
          <span
            key={i}
            style={{ background: `var(--book-${i})`, animationDelay: `${i * 0.11}s` }}
          />
        ))}
      </div>
      {/* 화면 읽어주는 프로그램에는 이 줄만 전달된다 */}
      <p role="status">{label}</p>
    </div>
  );
}
