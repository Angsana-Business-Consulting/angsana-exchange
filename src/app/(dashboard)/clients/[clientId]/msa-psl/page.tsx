import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function MsaPslPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="MSA-PSL"
      clientId={clientId}
      description="MSA and PSL configuration will appear here."
    />
  );
}
