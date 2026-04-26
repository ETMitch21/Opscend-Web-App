import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepairNotifications } from './repair-notifications';

describe('RepairNotifications', () => {
  let component: RepairNotifications;
  let fixture: ComponentFixture<RepairNotifications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepairNotifications]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RepairNotifications);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
