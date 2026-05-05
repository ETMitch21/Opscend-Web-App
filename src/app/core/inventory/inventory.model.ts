import type { ProductStatus } from '../products/products-model';

export type InventoryLocationType = 'shop' | 'vehicle' | 'storage' | 'other';

export type InventoryMovementType =
    | 'received'
    | 'adjustment'
    | 'reserved'
    | 'unreserved'
    | 'consumed'
    | 'returned'
    | 'damaged'
    | 'canceled';

export interface InventoryProductSummary {
    id: string;
    name: string;
    sku: string | null;
    status: ProductStatus;
    priceCents: number;
    costCents: number | null;
}

export interface InventoryLocationSummary {
    id: string;
    name: string;
    type: InventoryLocationType;
    isDefault: boolean;
    isActive: boolean;
}

export interface InventoryBalance {
    id: string;
    shopId: string;

    productId: string;
    locationId: string;

    product: InventoryProductSummary | null;
    location: InventoryLocationSummary | null;

    onHandQty: number;
    reservedQty: number;
    availableQty: number;
    onOrderQty: number;

    reorderPointQty: number | null;
    reorderQty: number | null;

    updatedAt: string;
}

export interface InventoryBalanceListResponse {
    data: InventoryBalance[];
    nextCursor: string | null;
}

export interface InventoryMovement {
    id: string;
    shopId: string;

    productId: string;
    locationId: string;

    product: InventoryProductSummary | null;
    location: InventoryLocationSummary | null;

    type: InventoryMovementType;

    quantityDelta: number;

    onHandBefore: number | null;
    onHandAfter: number | null;
    reservedBefore: number | null;
    reservedAfter: number | null;
    onOrderBefore: number | null;
    onOrderAfter: number | null;

    reason: string | null;
    notes: string | null;

    repairId: string | null;
    purchaseOrderId: string | null;
    purchaseOrderItemId: string | null;

    createdBy: string;
    createdAt: string;
}

export interface InventoryMovementListResponse {
    data: InventoryMovement[];
    nextCursor: string | null;
}

export interface InventoryListParams {
    limit?: number;
    cursor?: string | null;

    q?: string;
    locationId?: string;

    lowStockOnly?: boolean;
    outOfStockOnly?: boolean;
    includeInactiveProducts?: boolean;
}

export interface InventoryMovementListParams {
    limit?: number;
    cursor?: string | null;

    locationId?: string;
    type?: InventoryMovementType;
}

export interface InventoryAdjustPayload {
    locationId?: string;

    /**
     * Positive adds stock.
     * Negative removes stock.
     */
    quantityDelta: number;

    reason?: string | null;
    notes?: string | null;
}

export interface InventoryBalancePatchPayload {
    locationId?: string;
    reorderPointQty?: number | null;
    reorderQty?: number | null;
}