import { isPlatformServer } from '@angular/common';
import {
  inject,
  makeStateKey,
  PLATFORM_ID,
  Service,
  TransferState,
} from '@angular/core';
import { WINDOW } from '../window';

const STORAGE_STATE_KEY = makeStateKey<[string, string][]>('APP_STORAGE_STATE');

@Service()
export class LocalStorage {
  // Dependencies
  private transferState = inject(TransferState);
  private window = inject(WINDOW);

  // State
  private isServer = isPlatformServer(inject(PLATFORM_ID));
  private storage = new Map<string, string>();

  constructor() {
    // Restore the localStorage from the transfer state in the browser
    if (!this.isServer) {
      new Map(this.transferState.get(STORAGE_STATE_KEY, [])).forEach(
        (value, key) => {
          this.setItem(key, value);
        }
      );
    }
  }

  /**
   * Returns the browser's localStorage, or null when it is unavailable.
   */
  private get localStorage(): Storage | null {
    // Browsers throw on access when storage is denied
    try {
      return this.window?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Updates the transfer state with the given map.
   */
  private updateTransferState(map: Map<string, string>) {
    this.transferState.set(STORAGE_STATE_KEY, Array.from(map.entries()));
  }

  /**
   * Returns the number of key/value pairs.
   */
  get length(): number {
    if (this.isServer) {
      return this.storage.size;
    }

    if (this.localStorage) {
      return this.localStorage.length;
    }

    return 0;
  }

  /**
   * Sets the value of the pair identified by key to value,
   * creating a new key/value pair if none existed for key previously.
   */
  setItem(key: string, value: string): void {
    if (this.isServer) {
      this.storage.set(key, value);
      this.updateTransferState(this.storage);
      return;
    }

    if (this.localStorage) {
      this.localStorage.setItem(key, value);
    }
  }

  /**
   * Returns the current value associated with the given key,
   * or null if the given key does not exist in the list associated
   * with the object.
   */
  getItem(key: string): string | null {
    if (this.isServer) {
      return this.storage.get(key) ?? null;
    }

    if (this.localStorage) {
      return this.localStorage.getItem(key);
    }

    return null;
  }

  /**
   * Removes the key/value pair with the given key,
   * if a key/value pair with the given key exists.
   */
  removeItem(key: string): void {
    if (this.isServer) {
      this.storage.delete(key);
      this.updateTransferState(this.storage);
      return;
    }

    if (this.localStorage) {
      this.localStorage.removeItem(key);
    }
  }

  /**
   * Removes all key/value pairs, if there are any.
   */
  clear(): void {
    if (this.isServer) {
      this.storage.clear();
      this.updateTransferState(this.storage);
      return;
    }

    if (this.localStorage) {
      this.localStorage.clear();
    }
  }

  /**
   * Returns the name of the nth key in the list.
   */
  key(index: number): string | null {
    if (this.isServer) {
      return Array.from(this.storage.keys())[index] ?? null;
    }

    if (this.localStorage) {
      return this.localStorage.key(index);
    }

    return null;
  }
}
