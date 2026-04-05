import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Approvals"
      clientId={clientId}
      description="Items awaiting client review and approval will appear here."
    />
  );
}
