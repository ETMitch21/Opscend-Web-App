import { TestBed } from '@angular/core/testing';

import { SchedulingModalService } from './schedulingModal-service';

describe('SchedulingService', () => {
  let service: SchedulingModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SchedulingModalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
