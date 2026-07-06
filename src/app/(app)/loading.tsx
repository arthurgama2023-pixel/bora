import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";

// Fallback genérico para rotas sob (app) que não têm um loading.tsx próprio
// (páginas de detalhe, formulários de novo/editar). O layout + menu permanecem
// interativos; só esta área troca instantaneamente pelo skeleton.
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions />
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
