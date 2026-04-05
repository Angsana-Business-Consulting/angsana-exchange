import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function SoWhatsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="So Whats"
      clientId={clientId}
      description="The client's Power of So What library will appear here."
    />
  );
}
