import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <div className="mt-6">
        <CardGridSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-2" />
      </div>
    </>
  );
}
