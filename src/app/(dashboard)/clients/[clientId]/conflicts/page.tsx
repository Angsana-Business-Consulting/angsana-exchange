import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function ConflictsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Conflicts"
      clientId={clientId}
      description="Conflict rules prevent prospecting into accounts where another client has an active relationship. This module is coming in a future update."
    />
  );
}
