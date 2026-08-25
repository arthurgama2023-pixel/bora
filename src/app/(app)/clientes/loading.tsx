import { PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions />
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
      <TableSkeleton rows={8} cols={8} />
    </>
  );
}
