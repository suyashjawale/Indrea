import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import pako from 'pako';  // For decompressing Gzip
import * as numpyParser from 'numpy-parser';
import JSZip from 'jszip';

@Component({
	selector: 'app-select-fif-channel',
	imports: [FormsModule],
	templateUrl: './select-fif-channel.component.html',
	styleUrl: './select-fif-channel.component.css'
})
export class SelectFifChannelComponent {
	file_data: any = [];
	channels: string[] = [];
	eegChannels: string[] = [];
	fileName: string = "";
	selectedChannel: string[] = [];
	checkbox: boolean[] = [];
	disableProceed: boolean = false;
	finalSubmit: boolean = false;
	imageLoaded: number = 0;
	sensorPlotUrl: string = '';
	selected_files : string[] = [];
	rejected_files : string[] = [];
	montage_types: string[] = ['standard_1020', 'standard_1005', 'standard_alphabetic', 'standard_postfixed', 'standard_prefixed',
		'standard_primed', 'biosemi16', 'biosemi32', 'biosemi64', 'biosemi128', 'biosemi160', 'biosemi256', 'easycap-M1', 'easycap-M10',
		'easycap-M43', 'EGI_256', 'GSN-HydroCel-32', 'GSN-HydroCel-64_1.0', 'GSN-HydroCel-65_1.0', 'GSN-HydroCel-128', 'GSN-HydroCel-129',
		'GSN-HydroCel-256', 'GSN-HydroCel-257', 'mgh60', 'mgh70', 'artinis-octamon', 'artinis-brite23', 'brainproducts-RNP-BA-128'];

	selectedMontage: string = 'standard_1020';

	constructor(private http: HttpClient, private router: Router) {
		const navigation = this.router.getCurrentNavigation();
		this.file_data = navigation?.extras.state?.['data'] || [];
		this.eegChannels = navigation?.extras.state?.['eeg_channels'] || [];
		this.channels = this.file_data[0].channel_list;
		this.checkbox = Array(this.channels.length).fill(false);

		for(let i=0;i<this.file_data.length;i++){
			if(this.file_data[i]['valid']){
				this.selected_files.push(this.file_data[i].filename)
			}
			else{
				this.rejected_files.push(this.file_data[i].filename)
			}
		}
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
			this.http.post('http://localhost:8000/select-fif-channel', { "selected_ch": selected, "montage": this.selectedMontage }, { responseType: 'arraybuffer' })
				.subscribe({
					next: async (compressedResponse: ArrayBuffer) => {
						this.router.navigate(['/process'], { state: { channels: selected } });
					},
					error: (err) => {
						console.error('❌ Upload failed:', err);
						this.disableProceed = false;
					}
				});
		}
	}

	back() {
		this.router.navigate(['/upload-fif']);
	}

	toggleSelection(stage: number) {
		switch (stage) {
			case 1:
				this.checkbox.fill(false);
				break;
			case 3:
				this.checkbox.fill(true);
				break;
		}
	}
}
