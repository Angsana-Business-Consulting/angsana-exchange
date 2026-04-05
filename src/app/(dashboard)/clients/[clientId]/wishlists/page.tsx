import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function WishlistsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <PlaceholderPage
      title="Wishlists"
      clientId={clientId}
      description="Target company wishlists will appear here."
    />
  );
}
