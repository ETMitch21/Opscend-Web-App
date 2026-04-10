import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopIntegrations } from './shop-integrations';

describe('ShopIntegrations', () => {
  let component: ShopIntegrations;
  let fixture: ComponentFixture<ShopIntegrations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopIntegrations]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopIntegrations);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
