import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageDevicesModalComponent } from './manage-devices-modal-component';

describe('ManageDevicesModalComponent', () => {
  let component: ManageDevicesModalComponent;
  let fixture: ComponentFixture<ManageDevicesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageDevicesModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageDevicesModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
