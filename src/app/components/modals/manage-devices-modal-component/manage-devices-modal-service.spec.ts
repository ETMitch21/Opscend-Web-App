import { TestBed } from '@angular/core/testing';

import { ManageDevicesModalService } from './manage-devices-modal-service';

describe('ManageDevicesModalService', () => {
  let service: ManageDevicesModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ManageDevicesModalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
