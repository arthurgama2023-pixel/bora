import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions />
      <TableSkeleton rows={6} cols={6} />
    </>
  );
}
