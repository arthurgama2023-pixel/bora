// Ícone por tipo de movimentação — usado no seletor de "Nova movimentação" e
// no filtro da lista (fonte única, mesmo padrão de src/lib/nav-items.ts).
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  PackageCheck,
  PackageMinus,
  ShoppingCart,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { MovementType } from "@/lib/enums";

export const MOVEMENT_TYPE_ICONS: Record<MovementType, LucideIcon> = {
  DELIVERY: PackageCheck,
  PICKUP: PackageMinus,
  SWAP: ArrowLeftRight,
  PURCHASE: ShoppingCart,
  SALE: Banknote,
  ADJUSTMENT: SlidersHorizontal,
  LOSS: AlertTriangle,
  MAINTENANCE: Wrench,
};
