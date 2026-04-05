import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function DncPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="DNC / MSA-PSL"
      clientId={clientId}
      description="Do Not Contact lists and MSA/PSL configuration will appear here."
    />
  );
}
