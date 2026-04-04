export interface Customer {
  id: string;
  shopId: string;

  name: string;
  email: string | null;
  phone: string | null;

  tags: string[];
  notes: string | null;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  data: Customer[];
  nextCursor: string | null;
}

export interface CustomerListQuery {
  limit?: number;
  cursor?: string | null;
  search?: string;
  includeDeleted?: boolean;
}

export interface CreateCustomerRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  notes?: string | null;
}