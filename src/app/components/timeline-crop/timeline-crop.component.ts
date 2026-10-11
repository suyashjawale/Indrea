import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-timeline-crop',
  imports: [CommonModule],
  templateUrl: './timeline-crop.component.html',
  styleUrl: './timeline-crop.component.css'
})
export class TimelineCropComponent implements AfterViewInit {
  
  @Input() totalDuration: number = 600; // in seconds
  @ViewChild('timeline') timelineRef!: ElementRef;
  @Output() cropRange = new EventEmitter<{ start: number; end: number }>();

  startTime = 10;
  endTime = 40;
  zoomLevel = 1;
  scrollOffset = 0;

  isDragging = false;
  dragTarget: 'start' | 'end' | null = null;

  get startPercent() {
    return ((this.startTime - this.scrollOffset) / (this.totalDuration / this.zoomLevel)) * 100;
  }

  get endPercent() {
    return ((this.endTime - this.scrollOffset) / (this.totalDuration / this.zoomLevel)) * 100;
  }

  ngAfterViewInit() {
    this.updateTimelineTransform();
  }

  startDrag(type: 'start' | 'end') {
    this.isDragging = true;
    this.dragTarget = type;
  }

  @HostListener('document:mouseup')
  stopDrag() {
    this.isDragging = false;
    this.dragTarget = null;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isDragging || !this.dragTarget) return;
    const rect = this.timelineRef.nativeElement.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width);
    const newTime = (percent * (this.totalDuration / this.zoomLevel)) + this.scrollOffset;

    if (this.dragTarget === 'start') {
      this.startTime = Math.max(0, Math.min(newTime, this.endTime - 1));
    } else {
      this.endTime = Math.min(this.totalDuration, Math.max(newTime, this.startTime + 1));
    }
  }

  onScroll(event: Event) {
    const el = event.target as HTMLElement;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const scrollRatio = el.scrollLeft / maxScroll;
    this.scrollOffset = scrollRatio * this.totalDuration * (1 - 1 / this.zoomLevel);
    this.updateTimelineTransform();
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? 0.1 : -0.1;
    this.zoomLevel = Math.max(1, this.zoomLevel + zoomDelta);
    this.updateTimelineTransform();
  }

  updateTimelineTransform() {
    const timeline = this.timelineRef?.nativeElement as HTMLElement;
    if (!timeline) return;
    const scale = this.zoomLevel;
    timeline.style.transform = `scaleX(${scale})`;
    timeline.style.transformOrigin = 'left center';
    timeline.style.width = `${100 * scale}%`;
  }

  submitCrop() {
    console.log(`Crop from ${this.startTime}s to ${this.endTime}s`);
    this.cropRange.emit({ start: this.startTime, end: this.endTime });
  }
}