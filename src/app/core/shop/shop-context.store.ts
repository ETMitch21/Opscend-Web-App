// src/app/core/shop/shop-context.service.ts
import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";
import { finalize, shareReplay, tap } from "rxjs/operators";
import { Shop, ShopService } from "./shop-service"

@Injectable({ providedIn: "root" })
export class ShopContextService {
  private readonly shopService = inject(ShopService);

  private readonly shopSubject = new BehaviorSubject<Shop | null>(null);
  readonly shop$ = this.shopSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  private hasLoaded = false;
  private inFlight$?: Observable<Shop | null>;

  get shop(): Shop | null {
    return this.shopSubject.value;
  }

  get shopId(): string | null {
    return this.shopSubject.value?.id ?? null;
  }

  get shopName(): string {
    return this.shopSubject.value?.name ?? "";
  }

  get bookingEnabled(): boolean {
    return this.shopSubject.value?.settings.booking.enabled ?? false;
  }

  get timezone(): string | null {
    return this.shopSubject.value?.timezone ?? null;
  }

  get primaryColor(): string | null {
    return this.shopSubject.value?.branding.primaryColor ?? null;
  }

  /**
   * Loads once and caches in memory.
   * Reuses the same in-flight request to avoid duplicate dashboard calls.
   */
  load(force = false): Observable<Shop | null> {
    if (!force && this.hasLoaded) {
      return of(this.shopSubject.value);
    }

    if (!force && this.inFlight$) {
      return this.inFlight$;
    }

    this.loadingSubject.next(true);

    const request$ = this.shopService.getMyShop().pipe(
      tap((shop) => {
        this.shopSubject.next(shop);
        this.hasLoaded = true;
      }),
      finalize(() => {
        this.loadingSubject.next(false);
        this.inFlight$ = undefined;
      }),
      shareReplay(1)
    );

    this.inFlight$ = request$;
    return request$;
  }

  refresh(): Observable<Shop | null> {
    return this.load(true);
  }

  setShop(shop: Shop | null): void {
    this.shopSubject.next(shop);
    this.hasLoaded = true;
  }

  patchShop(partial: Partial<Shop>): void {
    const current = this.shopSubject.value;
    if (!current) return;

    this.shopSubject.next({
      ...current,
      ...partial,
    });
  }

  clear(): void {
    this.shopSubject.next(null);
    this.hasLoaded = false;
    this.inFlight$ = undefined;
    this.loadingSubject.next(false);
  }
}