import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions />
      <StatCardsSkeleton count={4} />
      <div className="mt-6">
        <TableSkeleton rows={6} cols={5} />
      </div>
    </>
  );
}
