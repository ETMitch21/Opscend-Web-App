import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyAvailabilityComponent } from './my-availability.component';

describe('MyAvailabilityComponent', () => {
  let component: MyAvailabilityComponent;
  let fixture: ComponentFixture<MyAvailabilityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyAvailabilityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyAvailabilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
