import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

/**
 * Target list approvals — Phase 2.
 * Clients will review and approve target lists here.
 */
export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Target List Approvals</CardTitle>
          <CardDescription>
            Review and approve target lists for your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
            <p className="text-sm text-[var(--muted)]">
              Target list approval workflows — coming in Phase 2
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
