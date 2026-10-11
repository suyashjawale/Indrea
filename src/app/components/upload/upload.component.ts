import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
	selector: 'app-upload',
	imports: [],
	templateUrl: './upload.component.html',
	styleUrl: './upload.component.css'
})
export class UploadComponent {
	selectedFile: File | null = null;
	notUploading : boolean = true;
	apiError : boolean = false;
	@ViewChild('fileInput') fileInput!: ElementRef;

	constructor(private http: HttpClient,private router: Router) {
	}

	onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (input.files?.length) {
			this.selectedFile = input.files[0];
		}
	}

	triggerFileInput() {
		this.fileInput.nativeElement.click();
	}

	uploadFile() {
		if (!this.selectedFile) return;
		this.notUploading = false;
		const formData = new FormData();
		formData.append('file', this.selectedFile);

		this.http.post<{ all_channels: string[], eeg_channels: string[]}>('http://localhost:8000/upload-edf', formData).subscribe({
			next: (response) => {
				this.router.navigate(['/select-channel'], { state: { channels: response.all_channels, eeg_channels: response.eeg_channels ,filename : this.selectedFile?.name,  } });
				this.selectedFile = null;
				this.notUploading = true;
			},
			error: (err) => {
				this.apiError = true;
				this.selectedFile = null;
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
			this.selectedFile = event.dataTransfer.files[0];
		}
	}
}
