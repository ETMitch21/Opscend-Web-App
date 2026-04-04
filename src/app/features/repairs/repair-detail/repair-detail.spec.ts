import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepairDetail } from './repair-detail';

describe('RepairDetail', () => {
  let component: RepairDetail;
  let fixture: ComponentFixture<RepairDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepairDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RepairDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
