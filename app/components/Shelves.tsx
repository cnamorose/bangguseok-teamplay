// 배경 책장 장식 (로그인 · 회원가입 등 인증 페이지 공용)
type Book = { color: string; height: number };

const TOP_LEFT: Book[] = [
  { color: "#c67a52", height: 96 },
  { color: "#cf8f5f", height: 108 },
  { color: "#d3a85e", height: 82 },
  { color: "#8faf74", height: 100 },
  { color: "#6d94b0", height: 90 },
  { color: "#9a7bb5", height: 104 },
];
const TOP_RIGHT: Book[] = [
  { color: "#c67a52", height: 92 },
  { color: "#8faf74", height: 106 },
];
const BOTTOM_LEFT: Book[] = [
  { color: "#c67a52", height: 88 },
  { color: "#7f9a6b", height: 100 },
  { color: "#d3a85e", height: 80 },
];
const BOTTOM_RIGHT: Book[] = [
  { color: "#6d94b0", height: 96 },
  { color: "#c67a52", height: 84 },
  { color: "#9a7bb5", height: 102 },
];

function BookRow({ books }: { books: Book[] }) {
  return (
    <div className="tp-book-row">
      {books.map((b, i) => (
        <div key={i} className="tp-book" style={{ height: b.height, background: b.color }} />
      ))}
    </div>
  );
}

export default function Shelves() {
  return (
    <div className="tp-shelves" aria-hidden="true">
      <div className="tp-shelf">
        <BookRow books={TOP_LEFT} />
        <BookRow books={TOP_RIGHT} />
      </div>
      <div className="tp-shelf">
        <BookRow books={BOTTOM_LEFT} />
        <BookRow books={BOTTOM_RIGHT} />
      </div>
    </div>
  );
}
