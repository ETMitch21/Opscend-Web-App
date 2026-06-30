export type ServiceStatus = 'active' | 'inactive';

export interface Service {
  id: string;
  shopId: string;

  name: string;
  code: string | null;
  status: ServiceStatus;

  /**
   * API returns cents.
   */
  price: number;

  /**
   * API returns minutes.
   */
  duration: number | null;

  tags: string[];

  createdAt: string;
  createdBy: string;
  updatedAt: string;

  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface ServiceListResponse {
  data: Service[];
  nextCursor: string | null;
}

export interface ServiceListParams {
  limit?: number;
  cursor?: string | null;
  status?: ServiceStatus;
  tag?: string;
  includeDeleted?: boolean;
}

export interface CreateServicePayload {
  name: string;
  code?: string | null;
  price: number;
  duration?: number | null;
  tags?: string[];
}

export interface PatchServicePayload {
  name?: string;
  code?: string | null;
  status?: ServiceStatus;
  price?: number;
  duration?: number | null;
  tags?: string[];
}
