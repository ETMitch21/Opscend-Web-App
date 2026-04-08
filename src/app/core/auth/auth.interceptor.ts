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
import { environment } from "../../../environments/environment";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getAccessToken();

    const isApiRequest =
      req.url.startsWith(environment.apiBase) || req.url.startsWith("/api/");

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
          err.status === 401 &&
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
              this.auth.clearLocalSession();
              return throwError(() => refreshErr);
            })
          );
        }

        return throwError(() => err);
      })
    );
  }
}