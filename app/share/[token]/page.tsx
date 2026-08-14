import SharedView from "./SharedView";

// 로그인하지 않은 사람도 열 수 있어야 하므로 RoomShell로 감싸지 않는다.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="tp-share-page">
      <SharedView token={token} />
    </div>
  );
}
