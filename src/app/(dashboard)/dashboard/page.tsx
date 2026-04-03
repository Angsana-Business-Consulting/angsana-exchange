import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

/**
 * Dashboard home — Phase 1 will embed Looker dashboards here.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Dashboards</CardTitle>
          <CardDescription>
            Live campaign status and activity dashboards will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
            <p className="text-sm text-[var(--muted)]">
              Looker dashboards — coming in Phase 1
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
