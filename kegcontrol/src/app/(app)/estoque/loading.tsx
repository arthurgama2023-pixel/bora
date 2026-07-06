import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <div className="mt-6">
        <TableSkeleton rows={6} cols={6} />
      </div>
    </>
  );
}
