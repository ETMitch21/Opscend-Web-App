import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopSettings } from './shop-settings';

describe('ShopSettings', () => {
  let component: ShopSettings;
  let fixture: ComponentFixture<ShopSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopSettings]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
