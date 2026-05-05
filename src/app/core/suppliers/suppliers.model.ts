export type SupplierProvider = 'mobilesentrix' | 'manual' | 'other';
export type SupplierStatus = 'active' | 'inactive';

export interface Supplier {
    id: string;
    shopId: string;

    name: string;
    provider: SupplierProvider;
    status: SupplierStatus;

    website: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;

    createdBy: string;
    createdAt: string;
    updatedAt: string;
    updatedBy: string | null;

    deletedAt: string | null;
    deletedBy: string | null;
}

export interface SupplierListResponse {
    data: Supplier[];
    nextCursor: string | null;
}

export interface SupplierListParams {
    limit?: number;
    cursor?: string | null;

    q?: string;
    provider?: SupplierProvider;
    status?: SupplierStatus;
    includeDeleted?: boolean;
}

export interface CreateSupplierPayload {
    name: string;
    provider?: SupplierProvider;
    status?: SupplierStatus;

    website?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
}

export interface PatchSupplierPayload {
    name?: string;
    provider?: SupplierProvider;
    status?: SupplierStatus;

    website?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
}