import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function RelationshipsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Relationships"
      clientId={clientId}
      description="Relationship records track MSA/PSL agreements and other formal relationships between clients and target companies. This module is coming in a future update."
    />
  );
}
