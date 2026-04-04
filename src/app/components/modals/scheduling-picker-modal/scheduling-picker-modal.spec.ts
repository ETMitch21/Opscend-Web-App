import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchedulingPickerModal } from './scheduling-picker-modal';

describe('SchedulingPickerModal', () => {
  let component: SchedulingPickerModal;
  let fixture: ComponentFixture<SchedulingPickerModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchedulingPickerModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchedulingPickerModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
