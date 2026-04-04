import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopUsers } from './shop-users';

describe('ShopUsers', () => {
  let component: ShopUsers;
  let fixture: ComponentFixture<ShopUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopUsers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopUsers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
