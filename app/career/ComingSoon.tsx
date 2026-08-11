// 취업방 화면들의 임시 자리.
// 껍데기(방 전환·메뉴·라우팅)가 먼저 돌아가는지 확인하려고 둔 것이고,
// 기능을 붙일 때 이 파일을 쓰는 페이지부터 하나씩 걷어낸다.
export default function ComingSoon({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="tp-shelf-empty">
      <div style={{ fontSize: 34, marginBottom: 8 }}>{emoji}</div>
      <strong>{title}</strong>
      <br />
      {desc}
    </div>
  );
}
