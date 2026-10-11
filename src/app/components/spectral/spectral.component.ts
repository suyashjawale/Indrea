import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import pako from 'pako';  // For decompressing Gzip
import * as numpyParser from 'numpy-parser';
import JSZip from 'jszip';
declare let Plotly: any;

@Component({
	selector: 'app-spectral',
	imports: [],
	templateUrl: './spectral.component.html',
	styleUrl: './spectral.component.css'
})
export class SpectralComponent {
	spectralFreq : number[] = [];
	spectralPos : number[][] = [];
	loading : boolean = true;
	constructor(private http: HttpClient) {
	}

	ngOnInit() {
		this.http.get('http://localhost:8000/ica-spectrum', { responseType: 'arraybuffer' })
			.subscribe({
				next: async (compressedResponse: ArrayBuffer) => {

					const data = await this.processResponse(compressedResponse);
					this.spectralFreq = data['freqs.npy'].data;
					let matrix = data['psds.npy'].data;
					let shape = data['psds.npy'].shape;
					this.spectralPos = this.get2dArray(matrix, shape);
					this.plotIcaSpectrum(this.spectralFreq,this.spectralPos);
					this.loading = false;
				},
				error: (err) => {
					console.error('❌ Upload failed:', err);
				}
			});
	}

	plotIcaSpectrum(freqs: number[], psds: number[][]) {
		const traces = psds.map((psd, idx) => ({
			x: freqs,
			y: psd,
			type: 'scatter',
			mode: 'lines',
			name: `Component ${idx}`,
			line: {
				width: 2
			}
		}));

		const layout = {
			title: 'Power Spectral Density of ICA Components',
			xaxis: {
				title: 'Frequency (Hz)',
				type: 'linear',
				showline: false,
				zeroline: true,
				zerolinecolor: '#e5e5e5', // Match other grid lines
				zerolinewidth: 1,
				gridcolor: '#e5e5e5',
				gridwidth: 1
			},
			yaxis: {
				title: 'Power Spectral Density (dB)',
				gridcolor: '#e5e5e5',
				gridwidth: 1
			},
			hovermode: 'closest',
			autosize: true,
			dragmode: 'pan',
			margin: { l: 60, r: 30, t: 40, b: 40 }
		};

		const config = {
			scrollZoom: true, // Allow zoom on x-axis
			responsive: true,
			displayModeBar: true,
			displaylogo: false,
			// modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d', 'toggleSpikelines', 'toImage'],
			// modeBarButtonsToAdd: ['zoomIn2d', 'zoomOut2d']
		};

		Plotly.newPlot('spectralPlt', traces, layout, config);
	}

		get2dArray(matrix: Float32Array, shape: number[]) {
		const arr = new Array(shape[0]); // Preallocate the main array

		for (let i = 0, idx = 0; i < shape[0]; i++, idx += shape[1]) {
			arr[i] = matrix.subarray(idx, idx + shape[1]); // Avoids copying
		}

		return arr;
	}

	private async processResponse(compressedData: ArrayBuffer): Promise<Record<string, any>> {
		const extractedFiles: Record<string, any> = {};
		try {
			// Decompress Gzip
			const decompressedData = pako.ungzip(new Uint8Array(compressedData));

			// Extract ZIP contents
			const zip = await JSZip.loadAsync(decompressedData);
			const npzFiles = Object.keys(zip.files);

			// Process .npy files
			for (const fileName of npzFiles) {
				const fileData = await zip.files[fileName].async('arraybuffer');
				extractedFiles[fileName] = numpyParser.fromArrayBuffer(fileData);
			}
		} catch (err) {
			console.error('❌ Error processing response:', err);
		}

		return extractedFiles;
	}
}
