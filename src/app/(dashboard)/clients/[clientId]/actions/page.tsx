import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function ActionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Actions"
      clientId={clientId}
      description="Action tracker for campaign follow-ups will appear here."
    />
  );
}
