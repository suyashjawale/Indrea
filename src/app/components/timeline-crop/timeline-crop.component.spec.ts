import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimelineCropComponent } from './timeline-crop.component';

describe('TimelineCropComponent', () => {
  let component: TimelineCropComponent;
  let fixture: ComponentFixture<TimelineCropComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineCropComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimelineCropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
