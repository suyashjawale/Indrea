import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { TimelineCropComponent } from '../timeline-crop/timeline-crop.component';
declare const Plotly: any;

@Component({
  selector: 'app-upload-video',
  imports: [CommonModule, TimelineCropComponent],
  templateUrl: './upload-video.component.html',
  styleUrls: ['./upload-video.component.css']
})
export class UploadVideoComponent implements AfterViewInit {

  constructor(private http: HttpClient) { }

  @ViewChild('videoPlayer') videoPlayer!: ElementRef;
  @ViewChild('eegChart') eegChart!: ElementRef;
  

  videoSrc: string = '';
  eegData: any;
  loading = false;
  cursorInterval: any;
  videoDuration = 0;



  updateCursor() {
    if (!this.eegData || !this.videoPlayer) return;
    const currentTime = this.videoPlayer.nativeElement.currentTime;
    const xCursor = [currentTime, currentTime];
    const traceIndex = this.eegData.channels.length; // Last trace is the cursor

    Plotly.restyle(this.eegChart.nativeElement, { x: [xCursor] }, [traceIndex]);
  }

  ngAfterViewInit(): void {
    const video = this.videoPlayer.nativeElement;

    video.addEventListener('play', () => {
      this.cursorInterval = setInterval(() => this.updateCursor(), 100);
    });

    video.addEventListener('pause', () => {
      clearInterval(this.cursorInterval);
    });

    video.addEventListener('ended', () => {
      clearInterval(this.cursorInterval);
    });
  }

  onVideoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      this.videoSrc = URL.createObjectURL(file);

      setTimeout(() => {
        if (this.videoPlayer?.nativeElement) {
          this.videoPlayer.nativeElement.load();
        }
      }, 100);
    }
  }

  onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const formData = new FormData();
      formData.append('file', input.files[0]);

      this.loading = true;
      this.http.post('http://localhost:8000/upload-fif', formData).subscribe((data: any) => {
        this.loading = false;
        this.eegData = data;
        this.plotEEG();
      });
    }
  }

  plotEEG() {
    setTimeout(() => {
      const traces = this.eegData.channels.map((ch: string, i: number) => ({
        x: this.eegData.times,
        y: this.eegData.values[i],
        type: 'scatter',
        mode: 'lines',
        name: ch
      }));

      let yMin = 0;
      let yMax = 100;

      try {
        const flatValues = this.eegData.values.reduce((acc: number[], row: number[] | number) => {
          return acc.concat(Array.isArray(row) ? row : [row]);
        }, []);
        yMin = Math.min(...flatValues);
        yMax = Math.max(...flatValues);
      } catch (err) {
        if (Array.isArray(this.eegData.values)) {
          yMin = Math.min(...this.eegData.values);
          yMax = Math.max(...this.eegData.values);
        }
      }

      const cursor = {
        x: [0, 0],
        y: [yMin, yMax],
        type: 'scatter',
        mode: 'lines',
        line: { color: 'red', width: 2 },
        name: 'Cursor',
        showlegend: false,
        hoverinfo: 'skip'
      };

      traces.push(cursor);

      const layout = {
        title: 'EEG Signal',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Amplitude' },
        height: 600
      };

      Plotly.newPlot(this.eegChart.nativeElement, traces, layout, { responsive: true });
    }, 100);
  }

  onVideoLoaded() {
    this.videoDuration = this.videoPlayer.nativeElement.duration || 120;
  }

  handleCrop(event: { start: number; end: number }) {
    const { start, end } = event;
    console.log(`User selected crop from ${start}s to ${end}s`);

    // Optional: send to backend
    const body = {
      videoStart: start,
      videoEnd: end,
      eegStart: start,
      eegEnd: end
    };

    this.http.post('http://localhost:8000/crop', body).subscribe(response => {
      console.log('Crop completed:', response);
      // Optionally download or preview result here
    });
  }

} 
