import { TestBed } from '@angular/core/testing';

import { CustomerDevicesService } from './customer-devices.service';

describe('CustomerDevices', () => {
  let service: CustomerDevicesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomerDevicesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
