import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { getShopSlugFromHost } from "./tenant";

@Injectable({ providedIn: "root" })
export class TenantService {
    private slug$ = new BehaviorSubject<string | null>(null);
    
    init() {
        const slug = getShopSlugFromHost(window.location.hostname);
        this.slug$.next(slug);
    }

    getShopSlug() {
        return this.slug$.value;
    }
}