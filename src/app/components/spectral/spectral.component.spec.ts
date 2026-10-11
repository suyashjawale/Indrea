import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpectralComponent } from './spectral.component';

describe('SpectralComponent', () => {
  let component: SpectralComponent;
  let fixture: ComponentFixture<SpectralComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpectralComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpectralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
