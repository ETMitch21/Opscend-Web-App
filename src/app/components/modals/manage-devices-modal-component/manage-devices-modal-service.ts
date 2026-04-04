import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ManageDevicesModalService {
  private readonly customerIdSubject = new BehaviorSubject<string | null>(null);
  readonly customerId$ = this.customerIdSubject.asObservable();

  private readonly showDeviceModalSubject = new BehaviorSubject<boolean>(false);
  readonly showDeviceModal$ = this.showDeviceModalSubject.asObservable();

  private readonly modalClosedSubject = new Subject<void>();
  readonly modalClosed$ = this.modalClosedSubject.asObservable();

  setCustomerId(customerId: string | null): void {
    this.customerIdSubject.next(customerId);
  }

  clearCustomerId(): void {
    this.customerIdSubject.next(null);
  }

  open(customerId?: string): void {
    if (customerId !== undefined) {
      this.setCustomerId(customerId);
    }

    this.showDeviceModalSubject.next(true);
  }

  close(): void {
    this.showDeviceModalSubject.next(false);
    this.clearCustomerId();
    this.modalClosedSubject.next();
  }
}