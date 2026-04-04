import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { TenantService } from "./tenant.service";

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenant = inject(TenantService);
  const slug = tenant.getShopSlug();

  if (!slug) return next(req);

  return next(req.clone({ setHeaders: { "x-shop-slug": slug } }));
};
