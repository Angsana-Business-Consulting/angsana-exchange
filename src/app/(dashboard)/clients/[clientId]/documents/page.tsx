import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Documents"
      clientId={clientId}
      description="Shared documents and briefing materials will appear here."
    />
  );
}
