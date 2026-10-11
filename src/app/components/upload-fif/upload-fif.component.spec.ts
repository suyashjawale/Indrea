import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadFifComponent } from './upload-fif.component';

describe('UploadFifComponent', () => {
  let component: UploadFifComponent;
  let fixture: ComponentFixture<UploadFifComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadFifComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadFifComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
