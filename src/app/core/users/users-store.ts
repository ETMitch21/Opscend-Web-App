import { Injectable, computed, inject, signal } from '@angular/core';
import { UsersService } from './users-service';
import {
  CreateUserPayload,
  ListUsersParams,
  UpdateCurrentUserPayload,
  UpdateUserPayload,
  User,
} from './users.model';

@Injectable({
  providedIn: 'root',
})
export class UsersStore {
  private usersService = inject(UsersService);

  private usersSignal = signal<User[]>([]);
  private loadingSignal = signal(false);
  private loadedSignal = signal(false);
  private errorSignal = signal<string | null>(null);
  private nextCursorSignal = signal<string | null>(null);
  private currentUserSignal = signal<User | null>(null);

  public users = computed(() => this.usersSignal());
  public loading = computed(() => this.loadingSignal());
  public loaded = computed(() => this.loadedSignal());
  public error = computed(() => this.errorSignal());
  public nextCursor = computed(() => this.nextCursorSignal());
  public currentUser = computed(() => this.currentUserSignal());

  public activeUsers = computed(() =>
    this.usersSignal().filter((user) => user.status !== 'inactive')
  );

  public assignableUsers = computed(() =>
    this.usersSignal().filter((user) => {
      const status = user.status?.toLowerCase();
      return status !== 'inactive' && status !== 'invited';
    })
  );

  public hasUsers = computed(() => this.usersSignal().length > 0);

  async load(params?: ListUsersParams): Promise<User[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const response = await this.usersService.list(params);

      this.usersSignal.set(response.data ?? []);
      this.nextCursorSignal.set(response.nextCursor ?? null);
      this.loadedSignal.set(true);

      return response.data ?? [];
    } catch (error) {
      console.error('Failed to load users', error);
      this.errorSignal.set('Failed to load users');
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async loadMore(): Promise<User[]> {
    const cursor = this.nextCursorSignal();

    if (!cursor) {
      return this.usersSignal();
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const response = await this.usersService.list({
        cursor,
      });

      const existing = this.usersSignal();
      const incoming = response.data ?? [];

      const mergedMap = new Map<string, User>();

      for (const user of existing) {
        mergedMap.set(user.id, user);
      }

      for (const user of incoming) {
        mergedMap.set(user.id, user);
      }

      const merged = Array.from(mergedMap.values());

      this.usersSignal.set(merged);
      this.nextCursorSignal.set(response.nextCursor ?? null);
      this.loadedSignal.set(true);

      return merged;
    } catch (error) {
      console.error('Failed to load more users', error);
      this.errorSignal.set('Failed to load more users');
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async refresh(): Promise<User[]> {
    return await this.load();
  }

  async get(id: string): Promise<User> {
    this.errorSignal.set(null);

    try {
      const user = await this.usersService.get(id);
      this.upsertLocal(user);
      return user;
    } catch (error) {
      console.error(`Failed to get user ${id}`, error);
      this.errorSignal.set('Failed to load user');
      throw error;
    }
  }

  async create(payload: CreateUserPayload): Promise<User> {
    this.errorSignal.set(null);

    try {
      const created = await this.usersService.create(payload);
      this.upsertLocal(created);
      return created;
    } catch (error) {
      console.error('Failed to create user', error);
      this.errorSignal.set('Failed to create user');
      throw error;
    }
  }

  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    this.errorSignal.set(null);

    try {
      const updated = await this.usersService.update(id, payload);
      this.upsertLocal(updated);
      return updated;
    } catch (error) {
      console.error(`Failed to update user ${id}`, error);
      this.errorSignal.set('Failed to update user');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.errorSignal.set(null);

    try {
      await this.usersService.delete(id);
      this.removeLocal(id);
    } catch (error) {
      console.error(`Failed to delete user ${id}`, error);
      this.errorSignal.set('Failed to delete user');
      throw error;
    }
  }

  async restore(id: string): Promise<User> {
    this.errorSignal.set(null);

    try {
      const restored = await this.usersService.restore(id);
      this.upsertLocal(restored);
      return restored;
    } catch (error) {
      console.error(`Failed to restore user ${id}`, error);
      this.errorSignal.set('Failed to restore user');
      throw error;
    }
  }

  getById(id: string | null | undefined): User | null {
    if (!id) return null;
    return this.usersSignal().find((user) => user.id === id) ?? null;
  }

  getNameById(id: string | null | undefined): string | null {
    return this.getById(id)?.name ?? null;
  }

  clear() {
    this.usersSignal.set([]);
    this.currentUserSignal.set(null);
    this.nextCursorSignal.set(null);
    this.loadingSignal.set(false);
    this.loadedSignal.set(false);
    this.errorSignal.set(null);
  }

  private upsertLocal(user: User) {
    const users = this.usersSignal();
    const index = users.findIndex((x) => x.id === user.id);

    if (index === -1) {
      this.usersSignal.set([user, ...users]);
      return;
    }

    const next = [...users];
    next[index] = user;
    this.usersSignal.set(next);
  }

  private removeLocal(id: string) {
    this.usersSignal.set(this.usersSignal().filter((user) => user.id !== id));
  }

  async loadMe(): Promise<User> {
    this.errorSignal.set(null);

    try {
      const user = await this.usersService.getMe();
      this.currentUserSignal.set(user);
      this.upsertLocal(user);
      return user;
    } catch (error) {
      console.error('Failed to load current user', error);
      this.errorSignal.set('Failed to load current user');
      throw error;
    }
  }

  async updateMe(payload: UpdateCurrentUserPayload): Promise<User> {
    this.errorSignal.set(null);

    try {
      const updated = await this.usersService.updateMe(payload);
      this.currentUserSignal.set(updated);
      this.upsertLocal(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update current user', error);
      this.errorSignal.set('Failed to update current user');
      throw error;
    }
  }

}