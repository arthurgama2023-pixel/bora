import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions />
      <TableSkeleton rows={5} cols={5} />
    </>
  );
}
