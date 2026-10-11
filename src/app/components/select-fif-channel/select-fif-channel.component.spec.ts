import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectFifChannelComponent } from './select-fif-channel.component';

describe('SelectFifChannelComponent', () => {
  let component: SelectFifChannelComponent;
  let fixture: ComponentFixture<SelectFifChannelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectFifChannelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectFifChannelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
