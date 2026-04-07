import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcceptInviteComponent } from './accept-invite-component';

describe('AcceptInviteComponent', () => {
  let component: AcceptInviteComponent;
  let fixture: ComponentFixture<AcceptInviteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptInviteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcceptInviteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
