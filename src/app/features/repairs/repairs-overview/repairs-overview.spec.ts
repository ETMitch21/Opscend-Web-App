import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepairsOverview } from './repairs-overview';

describe('RepairsOverview', () => {
  let component: RepairsOverview;
  let fixture: ComponentFixture<RepairsOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepairsOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RepairsOverview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
