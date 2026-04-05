import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; campaignId: string }>;
}) {
  const { clientId, campaignId } = await params;
  return (
    <PlaceholderPage
      title="Campaign Detail"
      clientId={clientId}
      description={`Campaign ${campaignId} — full campaign detail view will appear here.`}
    />
  );
}
