import RelationshipsClient from './RelationshipsClient';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

/**
 * Relationships page — server component wrapper.
 * Replaces the "Coming soon" placeholder.
 * Follows the same pattern as Exclusions and Conflicts pages.
 */
export default async function RelationshipsPage({ params }: PageProps) {
  const { clientId } = await params;

  return (
    <div className="p-6">
      <RelationshipsClient clientId={clientId} />
    </div>
  );
}
