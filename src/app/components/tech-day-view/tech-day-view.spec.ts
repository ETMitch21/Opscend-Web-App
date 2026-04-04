import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TechDayView } from './tech-day-view';

describe('TechDayView', () => {
  let component: TechDayView;
  let fixture: ComponentFixture<TechDayView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechDayView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TechDayView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
