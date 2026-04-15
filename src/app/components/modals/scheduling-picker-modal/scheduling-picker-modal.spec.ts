import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchedulingPickerModalComponent } from './scheduling-picker-modal';

describe('SchedulingPickerModal', () => {
  let component: SchedulingPickerModalComponent;
  let fixture: ComponentFixture<SchedulingPickerModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchedulingPickerModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchedulingPickerModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
