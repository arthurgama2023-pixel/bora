import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={9} />
    </>
  );
}
