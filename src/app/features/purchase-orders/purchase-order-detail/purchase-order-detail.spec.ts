import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PurchaseOrderDetail } from './purchase-order-detail';

describe('PurchaseOrderDetail', () => {
  let component: PurchaseOrderDetail;
  let fixture: ComponentFixture<PurchaseOrderDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseOrderDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PurchaseOrderDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
