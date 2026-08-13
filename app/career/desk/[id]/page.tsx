import ApplicationView from "./ApplicationView";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApplicationView id={id} />;
}
