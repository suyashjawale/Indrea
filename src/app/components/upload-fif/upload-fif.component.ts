import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-upload-fif',
  imports: [],
  templateUrl: './upload-fif.component.html',
  styleUrl: './upload-fif.component.css'
})
export class UploadFifComponent {
  selectedFile: File[] = [];
  notUploading: boolean = true;
  apiError: boolean = false;
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(private http: HttpClient, private router: Router) {
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      for (let i = 0; i < input.files?.length; i++) {
        this.selectedFile.push(input.files[i]);
      }
    }
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  uploadFile() {
    if (!this.selectedFile) return;
    this.notUploading = false;
    const formData = new FormData();
    for (let i = 0; i < this.selectedFile.length; i++) {
      formData.append('files', this.selectedFile[i]);
    }

    this.http.post<any>('http://localhost:8000/bulk-upload-fif', formData).subscribe({
      next: (response) => {
        this.router.navigate(['/process-tab'], { state: { data: response['results'], eeg_channels: response['emotiv_eeg_channels'] } });
        this.selectedFile = [];
        this.notUploading = true;
      },
      error: (err) => {
        this.apiError = true;
        this.selectedFile = [];
        this.notUploading = true;
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // Required to allow drop
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      for (let i = 0; i < event.dataTransfer.files.length; i++) {
        this.selectedFile.push(event.dataTransfer.files[i]);
      }
    }
  }
}
