import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-5 h-72 w-full" />
        </Card>
      </div>
    </>
  );
}
