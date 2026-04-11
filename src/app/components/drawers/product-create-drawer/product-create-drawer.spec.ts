import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCreateDrawer } from './product-create-drawer';

describe('ProductCreateDrawer', () => {
  let component: ProductCreateDrawer;
  let fixture: ComponentFixture<ProductCreateDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCreateDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCreateDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
