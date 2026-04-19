import { Injectable } from "@angular/core";
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from "@angular/common/http";
import { Observable, catchError, switchMap, throwError } from "rxjs";
import { AuthService } from "./auth.service";
import { AppConfigService } from "../app-config/app-config.service";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private auth: AuthService,
    private appConfig: AppConfigService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.url === "/config.json" || req.url.endsWith("/config.json")) {
      return next.handle(req);
    }

    let apiBase = "";
    try {
      apiBase = this.appConfig.config.apiBase;
    } catch {
      return next.handle(req);
    }

    const token = this.auth.getAccessToken();

    const isApiRequest =
      req.url.startsWith(apiBase) || req.url.startsWith("/api/");

    const isAuthCall =
      req.url.includes("/auth/login") ||
      req.url.includes("/auth/refresh") ||
      req.url.includes("/auth/logout") ||
      req.url.includes("/auth/magic") ||
      req.url.includes("/auth/password");

    const shouldAttachToken = !!token && isApiRequest && !isAuthCall;

    const authedReq = shouldAttachToken
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authedReq).pipe(
      catchError((err: unknown) => {
        if (
          err instanceof HttpErrorResponse &&
          (err.status === 401 || err.status === 403) &&
          token &&
          isApiRequest &&
          !isAuthCall
        ) {
          return this.auth.refresh().pipe(
            switchMap(() => {
              const newToken = this.auth.getAccessToken();
              if (!newToken) return throwError(() => err);

              return next.handle(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                })
              );
            }),
            catchError((refreshErr) => {
              if (refreshErr instanceof HttpErrorResponse && (refreshErr.status === 401 || refreshErr.status === 403)) {
                this.auth.clearLocalSession();
              }
              return throwError(() => refreshErr);
            })
          );
        }

        return throwError(() => err);
      })
    );
  }
}