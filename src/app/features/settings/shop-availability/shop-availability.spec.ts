import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopAvailability } from './shop-availability';

describe('ShopAvailability', () => {
  let component: ShopAvailability;
  let fixture: ComponentFixture<ShopAvailability>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopAvailability]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopAvailability);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
