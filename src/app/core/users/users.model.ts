export interface User {
  id: string;
  shopId: string;

  name: string;
  email: string | null;
  phone: string | null;

  role: string;
  status: string;

  tags: string[];
  notes: string | null;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface UserListResponse {
  data: User[];
  nextCursor: string | null;
}

export interface ListUsersParams {
  limit?: number;
  cursor?: string | null;
  includeDeleted?: boolean;
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  sendInvite?: boolean;
  tags?: string[];
  notes?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  status?: string;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateCurrentUserPayload {
  name: string;
  phone?: string | null;
  notes?: string | null;
}