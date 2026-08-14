import SharedView from "./SharedView";

// 로그인하지 않은 사람도 열 수 있어야 하므로 Shell로 감싸지 않는다.
// 틀(.ui-page)은 SharedView가 직접 세운다 — 밝기 설정을 읽어야 해서다.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedView token={token} />;
}
