import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import pako from 'pako';  // For decompressing Gzip
import * as numpyParser from 'numpy-parser';
import JSZip from 'jszip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd  } from '@angular/router';
import { ServerDownComponent } from "./components/server-down/server-down.component";
import { LoadingComponent } from "./components/loading/loading.component";
declare let Plotly: any;


@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, CommonModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent implements OnInit{

	showNav = false;
  	activeRoute = '';

	constructor(private router: Router) {
		// this.router.events.subscribe(event => {
		// if (event instanceof NavigationEnd) {
		// 	this.activeRoute = event.urlAfterRedirects;
		// 	this.showNav = ['/visualize', '/process', '/upload-video', '/export'].includes(this.activeRoute);
		// }
		// });
	}


	ngOnInit(): void {
		// this.router.navigate(['home'])
	}

	// loadingPhase = 1;
	// selectedFile: File | null = null;

	

	// plot(data1: any, data2: any, times: any) {
	// 	var trace1 = {
	// 		type: "scatter",
	// 		mode: "lines",
	// 		name: 'R1',
	// 		x: times,
	// 		y: data1,
	// 		line: { color: '#17BECF' }
	// 	}

	// 	var trace2 = {
	// 		type: "scatter",
	// 		mode: "lines",
	// 		name: 'R2',
	// 		x: times,
	// 		y: data2,
	// 		line: { color: '#7F7F7F' }
	// 	}

	// 	var data = [trace1, trace2];

	// 	var layout = {
	// 		title: {
	// 			text: 'Date'
	// 		},
	// 	};

	// 	Plotly.newPlot('myDiv', data, layout);
	// }

	// private async checkServerStatus(retries = 10, delay = 2000): Promise<void> {
	// 	for (let i = 0; i < retries; i++) {
	// 		try {
	// 			await this.http.get('http://127.0.0.1:8000/').toPromise();
	// 			this.loadingPhase = 3;
	// 			return;
	// 		} catch {
	// 			await new Promise(resolve => setTimeout(resolve, delay));
	// 		}
	// 	}
	// 	this.loadingPhase = 2;
	// }

	// onFileSelected(event: Event): void {
	// 	const input = event.target as HTMLInputElement;
	// 	if (input.files?.length) {
	// 		this.selectedFile = input.files[0];
	// 	}
	// }

	// uploadFile(): void {
	// 	if (!this.selectedFile) return;

	// 	const formData = new FormData();
	// 	formData.append('file', this.selectedFile);

	// 	this.http.post('http://localhost:8000/upload-edf', formData, { responseType: 'arraybuffer' })
	// 		.subscribe({
	// 			next: async (compressedResponse: ArrayBuffer) => {
	// 				const data = await this.processResponse(compressedResponse);
	// 				let matrix = data['data.npy'].data;
	// 				let shape = data['data.npy'].shape;
	// 				let mappings = this.get2dArray(matrix, shape);
	// 				// console.log(mappings);
	// 				// console.log(data['times.npy'].data)
	// 				// console.log(data['data.npy'].data)
	// 				this.plot(mappings[6], mappings[10], data['times.npy'].data);
	// 			},
	// 			error: (err) => console.error('❌ Upload failed:', err)
	// 		});
	// }

	// get2dArray(matrix: Float32Array, shape: number[]) {
	// 	const arr = new Array(shape[0]); // Preallocate the main array

	// 	for (let i = 0, idx = 0; i < shape[0]; i++, idx += shape[1]) {
	// 		arr[i] = matrix.subarray(idx, idx + shape[1]); // Avoids copying
	// 	}

	// 	return arr;
	// }

	// private async processResponse(compressedData: ArrayBuffer): Promise<Record<string, any>> {
	// 	const extractedFiles: Record<string, any> = {};

	// 	try {
	// 		// Decompress Gzip
	// 		const decompressedData = pako.ungzip(new Uint8Array(compressedData));

	// 		// Extract ZIP contents
	// 		const zip = await JSZip.loadAsync(decompressedData);
	// 		const npzFiles = Object.keys(zip.files);

	// 		// Process .npy files
	// 		for (const fileName of npzFiles) {
	// 			const fileData = await zip.files[fileName].async('arraybuffer');
	// 			if (fileName === 'channels.npy') {
	// 				extractedFiles[fileName] = new TextDecoder().decode(new Uint8Array(fileData)).split('\x00').filter(Boolean);
	// 			} else {
	// 				extractedFiles[fileName] = numpyParser.fromArrayBuffer(fileData);
	// 			}
	// 		}
	// 	} catch (err) {
	// 		console.error('❌ Error processing response:', err);
	// 	}

	// 	return extractedFiles;
	// }
}