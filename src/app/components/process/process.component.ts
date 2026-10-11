import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

interface Band {
  lower: number;
  upper: number;
}


@Component({
  selector: 'app-process',
  imports: [FormsModule],
  templateUrl: './process.component.html',
  styleUrl: './process.component.css'
})
export class ProcessComponent {

  step: 'pipeline' | 'extract' | 'plot' = 'pipeline';

  importedFiles: string[] = [];
  allFiles: string[] = [];
  selectedFiles: string[] = [];
  selectedFile: string = '';

  pipelineName = '';
  baselineStart = 0;
  baselineEnd = 5;
  baselineUnit = 'seconds';
  frequencyBands: { label: string, lower: number, upper: number, selected: boolean }[] = [
    { label: 'Delta', lower: 0, upper: 4, selected: false },
    { label: 'Theta', lower: 4, upper: 8, selected: false },
    { label: 'Alpha', lower: 8, upper: 12, selected: false },
    { label: 'Beta', lower: 12, upper: 30, selected: false }
  ];
  epochDuration = 5;
  calculationMethod = 'Multitaper';
  rejectAnnotation = false;
  relativePower = false;

  pipelines: any[] = [];
  selectedPipeline = '';
  createdPipeline: any;

  showPlots = false;
  isExtracting = false;
  features: { name: string, value: string }[] = [];
  psdImageUrl = '';
  barImageUrl = '';
  channels: string[] = [];
  selectedChannel = '';
  useBaseline: boolean = true;

  // Time Domain Features
  timeFeatures: { name: string, selected: boolean }[] = [
    { name: 'Mean', selected: false },
    { name: 'Median', selected: false },
    { name: 'Variance', selected: false },
    { name: 'Standard Deviation', selected: false },
    { name: 'Skewness', selected: false },
    { name: 'Kurtosis', selected: false },
    { name: 'Zero crossing rate', selected: false },
    { name: 'Hjorth parameters', selected: false },
    { name: 'Energy', selected: false }
  ];
  selectAllTimeFeatures: boolean = false;

  pipelineStep: number = 1;


  addFrequencyBand() {
    this.frequencyBands.push({ label: 'Custom', lower: 0, upper: 0, selected: true });
  }

  nextStep() {
    this.pipelineStep++;
  }

  prevStep() {
    this.pipelineStep--;
  }

  toggleSelectAllTimeFeatures() {
    this.timeFeatures.forEach(f => f.selected = this.selectAllTimeFeatures);
  }

  fileMetadata: { [filename: string]: any } = {};

  constructor(private http: HttpClient) {
    this.getPipelines();
    this.getFiles();
  }

  createPipeline() {
    const bands: { [key: string]: { lower: number, upper: number } } = {};
    this.frequencyBands.forEach((band, i) => {
      if (band.selected) {
        bands[band.label.toLowerCase() || `band_${i}`] = {
          lower: band.lower,
          upper: band.upper
        };
      }
    });

    const payload = {
      basic_details: {
        name: this.pipelineName,
        baseline_period_start: this.baselineStart,
        baseline_period_end: this.baselineEnd,
        baseline_units: this.baselineUnit
      },
      time_domain_features: {
        features: this.timeFeatures.filter(f => f.selected).map(f => f.name)
      },
      frequency_domain_features: {
        frequency_bands: bands,
        band_power_estimation: {
          epochs_per_duration: this.epochDuration,
          calculation_method: this.calculationMethod,
          reject_by_annoatation: this.rejectAnnotation,
          relative_power: this.relativePower
        }
      }
    };

    this.http.post<any>('http://localhost:8000/create-pipeline', payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.createdPipeline = {
            ...payload,
            created_unix_time: res.created_unix_time,
            filename: res.filename
          };
          this.step = 'extract';
        }
      },
      error: (err) => console.error('Pipeline creation failed:', err)
    });
  }

  extractFeatures() {
    const payload = {
      pipeline_name: this.selectedPipeline,
      files: this.selectedFiles
    };
    this.isExtracting = true;
    this.http.post<any>('http://localhost:8000/extract-features', payload).subscribe({
      next: (res) => {
        this.features = res.time_features;
        this.psdImageUrl = 'data:image/png;base64,' + res.psd_image;
        this.barImageUrl = 'data:image/png;base64,' + res.band_image;
        this.channels = res.psd_channels;
        this.selectedChannel = this.channels[0];
        this.showPlots = true;
        this.isExtracting = false;
      },
      error: () => {
        this.isExtracting = false;
        alert('Feature extraction failed.');
      }
    });
  }

  getPipelines() {
    this.http.get<any[]>('http://localhost:8000/get-pipelines').subscribe({
      next: (res) => this.pipelines = res,
      error: (err) => console.error('Failed to load pipelines', err)
    });
  }

  getFiles() {
    this.http.get<any[]>('http://localhost:8000/get-files').subscribe({
      next: (res) => {
        this.allFiles = res;
        this.selectedFiles = res.slice(0, 1);
        this.importedFiles = res;
        this.getFileMetadata();
      },
      error: (err) => console.error('Failed to load files', err)
    });
  }

  getFileMetadata() {
    this.selectedFiles.forEach(file => {
      const filename = file.split('\\').pop();  // or path.basename(file) if needed
      this.http.get<any>(`http://localhost:8000/get-file-info?file=${filename}`).subscribe({
        next: (info) => this.fileMetadata[file] = info,
        error: (err) => console.warn('Failed to get metadata for', file, err)
      });
    });
  }

  updateChannel(event: any) {
    const selectedChannel = event.target.value;
    this.http.get(`http://localhost:8000/get-psd-bar?file=${this.selectedFiles[0]}&channel=${selectedChannel}`)
      .subscribe({
        next: (res: any) => {
          this.psdImageUrl = 'data:image/png;base64,' + res.psd;
          this.barImageUrl = 'data:image/png;base64,' + res.bar;
        },
        error: (err) => console.error('Failed to get plots', err)
      });
  }



}
