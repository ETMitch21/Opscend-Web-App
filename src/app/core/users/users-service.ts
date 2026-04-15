import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CreateUserPayload,
  ListUsersParams,
  UpdateCurrentUserPayload,
  UpdateUserPayload,
  User,
  UserListResponse,
} from './users.model';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private appConfig = inject(AppConfigService);
  private http = inject(HttpClient);

  private get apiBase(): string {
    return this.appConfig.config.apiBase;
  }

  async list(params?: ListUsersParams): Promise<UserListResponse> {
    let httpParams = new HttpParams();

    if (params?.limit != null) {
      httpParams = httpParams.set('limit', params.limit);
    }

    if (params?.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }

    if (params?.includeDeleted != null) {
      httpParams = httpParams.set('includeDeleted', String(params.includeDeleted));
    }

    return await firstValueFrom(
      this.http.get<UserListResponse>(`${this.apiBase}/users`, { params: httpParams })
    );
  }

  async get(id: string): Promise<User> {
    return await firstValueFrom(this.http.get<User>(`${this.apiBase}/users/${id}`));
  }

  async getMe(): Promise<User> {
    return await firstValueFrom(this.http.get<User>(`${this.apiBase}/users/me`));
  }

  async create(payload: CreateUserPayload): Promise<User> {
    return await firstValueFrom(this.http.post<User>(`${this.apiBase}/users`, payload));
  }

  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    return await firstValueFrom(this.http.patch<User>(`${this.apiBase}/users/${id}`, payload));
  }

  async updateMe(payload: UpdateCurrentUserPayload): Promise<User> {
    return await firstValueFrom(this.http.patch<User>(`${this.apiBase}/users/me`, payload));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.apiBase}/users/${id}`));
  }

  async restore(id: string): Promise<User> {
    return await firstValueFrom(this.http.post<User>(`${this.apiBase}/users/${id}/restore`, {}));
  }
}