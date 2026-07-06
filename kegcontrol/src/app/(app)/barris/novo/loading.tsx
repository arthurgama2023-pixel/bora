import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <FormSkeleton fields={6} />
    </>
  );
}
