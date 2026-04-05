import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Dashboard"
      clientId={clientId}
      description="Looker-embedded campaign dashboards will appear here."
    />
  );
}
