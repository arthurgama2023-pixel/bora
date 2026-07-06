import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="max-w-2xl space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="mt-4 h-10 w-full rounded-lg" />
          </Card>
        ))}
      </div>
    </>
  );
}
