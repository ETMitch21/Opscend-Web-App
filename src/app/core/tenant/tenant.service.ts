import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { getShopSlugFromHost } from "./tenant";

@Injectable({ providedIn: "root" })
export class TenantService {
    private readonly storageKey = "px_active_shop_slug";
    private slug$ = new BehaviorSubject<string | null>(null);

    init() {
        const storedSlug = localStorage.getItem(this.storageKey)?.trim().toLowerCase() || null;
        const hostSlug = getShopSlugFromHost(window.location.hostname);
        this.slug$.next(storedSlug || hostSlug);
    }

    getShopSlug() {
        return this.slug$.value;
    }

    setShopSlug(slug: string | null): void {
        const normalized = slug?.trim().toLowerCase() || null;

        if (normalized) {
            localStorage.setItem(this.storageKey, normalized);
        } else {
            localStorage.removeItem(this.storageKey);
        }

        this.slug$.next(normalized);
    }

    resetToHost(): void {
        localStorage.removeItem(this.storageKey);
        this.slug$.next(getShopSlugFromHost(window.location.hostname));
    }
}
