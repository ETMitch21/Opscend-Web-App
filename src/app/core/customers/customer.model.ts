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

export interface CustomerAddress {
  id: string;
  shopId: string;
  customerId: string;

  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;

  isDefault: boolean;
  notes: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddressListResponse {
  data: CustomerAddress[];
}

export interface CreateCustomerAddressRequest {
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
  notes?: string | null;
}

export interface UpdateCustomerAddressRequest {
  label?: string | null;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
  notes?: string | null;
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

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CustomerAddress {
  id: string;
  shopId: string;
  customerId: string;

  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;

  geo: GeoPoint | null;

  isDefault: boolean;
  notes: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerAddressRequest {
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  geo?: GeoPoint | null;
  isDefault?: boolean;
  notes?: string | null;
}

export interface UpdateCustomerAddressRequest {
  label?: string | null;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  geo?: GeoPoint | null;
  isDefault?: boolean;
  notes?: string | null;
}