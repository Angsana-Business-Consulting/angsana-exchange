import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function CheckinsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Check-ins"
      clientId={clientId}
      description="Meeting history and check-in notes will appear here."
    />
  );
}
