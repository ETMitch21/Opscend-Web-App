export interface CustomerDevice {
  id: string;
  shopId: string;
  customerId: string;
  businessAccountId: string | null;

  catalogRef: string | null;
  displayName: string;
  brand: string | null;
  model: string | null;

  nickname: string | null;
  notes: string | null;

  assetTag: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  department: string | null;
  fleetStatus: 'active' | 'spare' | 'retired' | 'lost';

  imei: string | null;
  serial: string | null;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string | null;
}

export interface CustomerDeviceListResponse {
  data: CustomerDevice[];
  nextCursor: string | null;
}

export interface CustomerDeviceListQuery {
  limit?: number;
  search?: string;
  cursor?: string | null;
}

export interface CreateCustomerDeviceRequest {
  catalogRef?: string;
  displayName: string;
  brand?: string;
  model?: string;

  nickname?: string;
  notes?: string | null;

  imei?: string;
  serial?: string;
}

export interface UpdateCustomerDeviceRequest {
  catalogRef?: string;
  displayName?: string;
  brand?: string;
  model?: string;

  nickname?: string;
  notes?: string | null;

  imei?: string;
  serial?: string;
}