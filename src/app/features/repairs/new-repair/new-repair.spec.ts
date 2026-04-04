import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewRepair } from './new-repair';

describe('NewRepair', () => {
  let component: NewRepair;
  let fixture: ComponentFixture<NewRepair>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewRepair]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewRepair);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
