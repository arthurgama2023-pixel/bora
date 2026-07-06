import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions />
      <CardGridSkeleton count={2} className="md:grid-cols-1 lg:grid-cols-2" />
    </>
  );
}
