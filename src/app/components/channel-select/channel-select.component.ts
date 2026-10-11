import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import pako from 'pako';  // For decompressing Gzip
import * as numpyParser from 'numpy-parser';
import JSZip from 'jszip';

@Component({
	selector: 'app-channel-select',
	imports: [FormsModule],
	templateUrl: './channel-select.component.html',
	styleUrl: './channel-select.component.css'
})

export class ChannelSelectComponent {
	channels: string[] = [];
	eegChannels: string[] = [];
	fileName: string = "";
	selectedChannel: string[] = [];
	checkbox: boolean[] = [];
	disableProceed: boolean = false;
	finalSubmit: boolean = false;
	imageLoaded: number = 0;
	sensorPlotUrl: string = '';

	montage_types: string[] = ['standard_1020', 'standard_1005', 'standard_alphabetic', 'standard_postfixed', 'standard_prefixed',
		'standard_primed', 'biosemi16', 'biosemi32', 'biosemi64', 'biosemi128', 'biosemi160', 'biosemi256', 'easycap-M1', 'easycap-M10',
		'easycap-M43', 'EGI_256', 'GSN-HydroCel-32', 'GSN-HydroCel-64_1.0', 'GSN-HydroCel-65_1.0', 'GSN-HydroCel-128', 'GSN-HydroCel-129',
		'GSN-HydroCel-256', 'GSN-HydroCel-257', 'mgh60', 'mgh70', 'artinis-octamon', 'artinis-brite23', 'brainproducts-RNP-BA-128'];

	selectedMontage: string = 'standard_1020';

	constructor(private http: HttpClient, private router: Router) {
		const navigation = this.router.getCurrentNavigation();
		this.channels = navigation?.extras.state?.['channels'] || [];
		this.fileName = navigation?.extras.state?.['filename'] || "";
		this.eegChannels = navigation?.extras.state?.['eeg_channels'] || [];
		this.checkbox = Array(this.channels.length).fill(false);
	}

	setMontage() {
		this.imageLoaded = 2;
		let selected = [];
		for (let i = 0; i < this.checkbox.length; i++) {
			if (this.checkbox[i]) {
				selected.push(this.channels[i]);
			}
		}

		if (selected.length > 0) {
			this.http.post('http://localhost:8000/select-montage', { "selected_ch": selected, "montage": this.selectedMontage }, { responseType: 'blob' })
				.subscribe({
					next: (blob: Blob) => {
						const url = URL.createObjectURL(blob);
						this.sensorPlotUrl = url;
						this.imageLoaded = 1;
					},
					error: (err) => {
						this.imageLoaded = 3;
						const reader = new FileReader();
						reader.onload = () => {
							const json = JSON.parse(reader.result as string);
							this.sensorPlotUrl = json.error;
						};
						reader.readAsText(err.error);
					}
				});
		}
	}

	proceed(): void {
		this.disableProceed = true;
		let selected = [];
		for (let i = 0; i < this.checkbox.length; i++) {
			if (this.checkbox[i]) {
				selected.push(this.channels[i]);
			}
		}

		if (selected.length > 0) {
			this.http.post('http://localhost:8000/select-channel', { "selected_ch": selected, "montage": this.selectedMontage }, { responseType: 'arraybuffer' })
				.subscribe({
					next: async (compressedResponse: ArrayBuffer) => {
						const data = await this.processResponse(compressedResponse);
						let matrix = data['data.npy'].data;
						let shape = data['data.npy'].shape;
						let mappings = this.get2dArray(matrix, shape);
						this.router.navigate(['/visualize'], { state: { channels: selected, mappings: mappings, times: data['times.npy'].data } });
					},
					error: (err) => {
						console.error('❌ Upload failed:', err);
						this.disableProceed = false;
					}
				});
		}
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

	back() {
		this.router.navigate(['/upload-edf']);
	}

	toggleSelection(stage: number) {
		switch (stage) {
			case 1:
				this.checkbox.fill(false);
				break;
			case 2:
				this.checkbox.fill(false);
				for (let i = 0; i < this.checkbox.length; i++) {
					if (this.eegChannels.includes(this.channels[i])) {
						this.checkbox[i] = true;
					}
				}
				break;
			case 3:
				this.checkbox.fill(true);
				break;
		}
	}
}