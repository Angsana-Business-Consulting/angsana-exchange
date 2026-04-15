import { ExclusionsClient } from './ExclusionsClient';

export default async function ExclusionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <ExclusionsClient clientId={clientId} />;
}
