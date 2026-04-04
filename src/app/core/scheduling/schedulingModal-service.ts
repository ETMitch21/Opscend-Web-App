import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
  SchedulingContext,
  SchedulingRequest,
  SchedulingSelection,
} from './scheduling.types';

@Injectable({
  providedIn: 'root',
})
export class SchedulingModalService {
  private readonly context$ = new BehaviorSubject<SchedulingContext>({
    isOpen: false,
    request: null,
  });

  readonly context: Observable<SchedulingContext> = this.context$.asObservable();

  private readonly confirmed$ = new Subject<SchedulingSelection>();
  readonly confirmed: Observable<SchedulingSelection> = this.confirmed$.asObservable();

  private readonly closed$ = new Subject<void>();
  readonly closed: Observable<void> = this.closed$.asObservable();

  open(request: SchedulingRequest): void {
    this.context$.next({
      isOpen: true,
      request,
    });
  }

  confirm(selection: SchedulingSelection): void {
    this.confirmed$.next(selection);
    this.close();
  }

  close(): void {
    this.context$.next({
      isOpen: false,
      request: null,
    });

    this.closed$.next();
  }
}