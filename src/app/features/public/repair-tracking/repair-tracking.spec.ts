import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepairTracking } from './repair-tracking';

describe('RepairTracking', () => {
  let component: RepairTracking;
  let fixture: ComponentFixture<RepairTracking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepairTracking]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RepairTracking);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
