import { Card } from "@/components/ui";
import {
  PageHeaderSkeleton,
  Skeleton,
  StatCardsSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={6} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-48 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-5 w-44" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
