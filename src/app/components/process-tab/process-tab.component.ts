import { CommonModule, NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
declare let Plotly: any;
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

interface fileData {
	uid: string,
	filename: string,
	isSelected: boolean
}

@Component({
	selector: 'app-process-tab',
	imports: [FormsModule, CommonModule],
	templateUrl: './process-tab.component.html',
	styleUrl: './process-tab.component.css'
})

export class ProcessTabComponent implements OnInit {

	@ViewChild('fileContainer') fileContainer!: ElementRef;
	maxHeight: number = 10;
	fileList: fileData[] = [];
	file_data: any;
	currentFile: any;
	baselineUnit: string = "seconds";
	showCreateTab1: boolean = true;
	showCreateTab2: boolean = false;
	selectedMainIdx: number = 0;
	selectedTask: string = 'baseline';
	selectedChannel: string = '';
	showCreateTab3: boolean = false;
	pipelineName: string = "";
	baselineStart: string = "";
	keys: string[] = [];
	resultState: string = "initial";
	baselineEnd: string = "";
	currentFileIdx: number = 0;
	viewFileIdx: number = 0;
	selectAllTimeFeatures: boolean = false;
	epochDuration = 5;
	calculationMethod = 'Multitaper';
	rejectAnnotation = false;
	Baseline = false;
	selectAllFif: boolean = false;
	relativePower = false;
	showExtract: boolean = false;
	pipelines: any = [];
	allFiles: any = [];
	selectedFiles: string[] = [];
	showCreate: boolean = false;
	editMode: boolean = false;
	editingPipelineTime: number | null = null;
	viewMode: boolean = false;
	showDeleteConfirmPipeline = false;
	showDeleteConfirmFile = false;
	fileToDelete: any = null;
	selectedFileName: string = '';
	pipelineToDelete: any = null;
	selectedPipelineName: string = '';
	selectedPipeline: string = '';
	eeg_channels: any = [];
	result: any = [];
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
	incrementFileIdx() {
		if (this.currentFileIdx < this.file_data.length - 1) {
			this.currentFileIdx++;
		} else {
			this.currentFileIdx = 0;
		}
	}

	selectAllFiles() {
		for (let i = 0; i < this.fileList.length; i++) {
			if (this.selectAllFif) {
				this.fileList[i].isSelected = true;
			}
			else {
				this.fileList[i].isSelected = false;
			}
		}
	}

	incrementMainWindowIdx() {
		if (this.selectedMainIdx < this.keys.length - 1) {
			this.selectedMainIdx++;
		} else {
			this.selectedMainIdx = 0;
		}
	}

	frequencyBands: { label: string, lower: number, upper: number, selected: boolean }[] = [
		{ label: 'Delta', lower: 0, upper: 4, selected: false },
		{ label: 'Theta', lower: 4, upper: 8, selected: false },
		{ label: 'Alpha', lower: 8, upper: 12, selected: false },
		{ label: 'Beta', lower: 12, upper: 30, selected: false }
	];

	addFrequencyBand() {
		this.frequencyBands.push({ label: 'Custom', lower: 0, upper: 0, selected: true });
	}

	selectPipeline(pipeline: any) {
		this.selectPipeline = pipeline;
	}

	isAnyTimeFeatureSelected(): boolean {
		return this.timeFeatures.some(obj => obj.selected);
	}

	plotBandPowerChart(bandPower: [string, number][]) {
		const bands = bandPower.map(([band]) => band.charAt(0).toUpperCase() + band.slice(1));
		const values = bandPower.map(([_, value]) => value);

		const trace = {
			x: bands,
			y: values,
			type: 'bar',
			marker: {
				color: 'steelblue',
				line: {
					width: 1
				}
			}
		};

		const layout = {
			title: {
				text: 'AF3 Average Band Power Plot',
				font: { size: 14 }
			},
			yaxis: {
				title: 'μV²',
				gridcolor: '#e5e5e5'
			},
			xaxis: {
				tickangle: -45
			},
			margin: { t: 40, b: 50, l: 50, r: 20 },
			height: 250,
			showlegend: false
		};

		const config = {
			responsive: true,
			displayModeBar: false
		};

		Plotly.newPlot('bandPowerChart', [trace], layout, config);
	}

	isAnyFilesSelected(): boolean {
		return this.fileList.some(obj => obj.isSelected);
	}

	isAnyfrequencyBandsSelected(): boolean {
		return this.frequencyBands.some(obj => obj.selected);
	}

	decrementFileIdx() {
		if (this.currentFileIdx > 0) {
			this.currentFileIdx--;
		} else {
			this.currentFileIdx = this.file_data.length - 1;
		}
	}

	decrementMainWindowIdx() {
		if (this.selectedMainIdx > 0) {
			this.selectedMainIdx--;
		} else {
			this.selectedMainIdx = this.keys.length - 1;
		}
	}

	constructor(private http: HttpClient, private router: Router) {
		const navigation = this.router.getCurrentNavigation();
		this.file_data = navigation?.extras.state?.['data'] || [];
		this.eeg_channels = navigation?.extras.state?.['eeg_channels'] || [];
		this.currentFile = this.file_data[0];
	}

	ngOnInit() {
		setTimeout(() => {
			if (this.fileContainer?.nativeElement) {
				this.maxHeight = this.fileContainer.nativeElement.clientHeight;
				this.fileContainer.nativeElement.style.maxHeight = `${this.maxHeight}px`;
			}

			for (let i = 0; i < this.file_data.length; i++) {
				this.fileList.push({
					uid: this.file_data[i]['uid'],
					filename: this.file_data[i]['filename'],
					isSelected: false
				});
			}
			this.selectedChannel = this.eeg_channels[0];
			this.getPipelines();
		});
	}

	getPipelines() {
		this.http.get<any[]>('http://localhost:8000/get-pipelines').subscribe({
			next: (res) => {
				this.pipelines = res;
				if (this.pipelines.length > 0) {
					this.selectedPipeline = this.pipelines[0].basic_details.name;
					this.showExtract = true;
				}
				else {
					this.showCreate = true;
				}
			},
			error: (err) => console.error('Failed to load pipelines', err)
		});
	}

	viewFile(ind: number) {
		this.currentFileIdx = ind;
	}

	showChannels(channels: string[]) {
		alert(channels);
	}

	toggleSelectAllTimeFeatures() {
		this.timeFeatures.forEach(f => f.selected = this.selectAllTimeFeatures);
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

		const payload: any = {
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

		if (this.editMode && this.editingPipelineTime) {
			payload.created_unix_time = this.editingPipelineTime;
		}

		this.http.post<any>('http://localhost:8000/create-pipeline', payload).subscribe({
			next: (res) => {
				if (res.success) {
					this.showCreate = false;
					this.showExtract = true;
					this.editMode = false;
					this.editingPipelineTime = null;
					this.resetCreatePipelineForm();
					this.getPipelines();
				}
			},
			error: (err) => console.error('Pipeline creation/edit failed:', err)
		});
	}


	editPipeline(pipeline: any) {
		this.editMode = true;
		this.editingPipelineTime = pipeline.created_unix_time;

		this.pipelineName = pipeline.basic_details.name;
		this.baselineStart = pipeline.basic_details.baseline_period_start;
		this.baselineEnd = pipeline.basic_details.baseline_period_end;
		this.baselineUnit = pipeline.basic_details.baseline_units;
		this.Baseline = !!(this.baselineStart || this.baselineEnd);

		this.timeFeatures.forEach(feature => {
			feature.selected = pipeline.time_domain_features.features.includes(feature.name);
		});

		this.frequencyBands = Object.entries(pipeline.frequency_domain_features.frequency_bands).map(([label, range]) => {
			const typedRange = range as { lower: number; upper: number };
			return {
				label: label.charAt(0).toUpperCase() + label.slice(1),
				lower: typedRange.lower,
				upper: typedRange.upper,
				selected: true
			};
		});

		const power = pipeline.frequency_domain_features.band_power_estimation;
		this.epochDuration = power.epochs_per_duration;
		this.calculationMethod = power.calculation_method;
		this.rejectAnnotation = power.reject_by_annoatation;
		this.relativePower = power.relative_power;

		// Switch to the create/edit form
		this.showExtract = false;
		this.showCreate = true;
		this.showCreateTab1 = true;
		this.showCreateTab2 = false;
		this.showCreateTab3 = false;
	}

	promptDelete(pipeline: any) {
		this.pipelineToDelete = pipeline;
		this.selectedPipelineName = pipeline.basic_details.name;
		this.showDeleteConfirmPipeline = true;
	}

	cancelDelete() {
		this.pipelineToDelete = null;
		this.showDeleteConfirmPipeline = false;
	}

	extractFeatures() {
		let selectedPipeline = this.pipelines.find((p: { basic_details: { name: string; }; }) => p.basic_details.name === this.selectedPipeline);
		let selectedFiles = this.fileList.filter(fif => fif.isSelected).map(fif => fif.uid);
		const payload = {
			pipeline: selectedPipeline,
			files_idx: selectedFiles,
			channel_list: this.eeg_channels
		};
		this.resultState = "loading";

		this.http.post<any>('http://localhost:8000/extract-features', payload).subscribe({
			next: (res) => {
				this.keys = Object.keys(res);
				this.result = res;
				this.resultState = "loaded";
				setTimeout(() => this.plotBandPowerChart(this.result[this.keys[this.selectedMainIdx]][this.selectedTask][this.selectedChannel]['band_power']), 1000);
			},
			error: () => {
				this.resultState = "failed";
			}
		});
	}


	getObjectKeys(fixed_keys: any) {
		return Object.keys(fixed_keys);
	}

	getCurrentFileName(file_id: string) {
		for (let i = 0; i < this.fileList.length; i++) {
			if (this.fileList[i]['uid'] == file_id) {
				return this.fileList[i].filename;
			}
		}
		return null;
	}

	formatExponent(num: number): string {
		if (num === 0) return '0';

		const absNum = Math.abs(num);
		const log10 = Math.log10(absNum);

		if (Number.isInteger(log10) && absNum >= 100) {
			const base = Math.sign(num) * 10;
			const exponent = log10;
			return `${base === 10 ? '' : base}<sup>${exponent}</sup>`;
		}

		if (absNum >= 100) {
			const exp = Math.floor(log10);
			return `10<sup>${exp}</sup>`;
		}

		return num.toFixed(1); // e.g., 9.2
	}

	getUnit(feature: string): string {
		const squared = ['variance', 'energy', 'hjorth_activity'];
		const volt = ['mean', 'median', 'std_dev'];
		if (squared.includes(feature)) return 'μV<sup>2</sup>';
		if (volt.includes(feature)) return 'μV';
		return '';
	}

	confirmDelete() {
		if (!this.pipelineToDelete) return;

		const created_unix_time = this.pipelineToDelete.created_unix_time;
		this.http.delete(`http://localhost:8000/delete-pipeline?created_unix_time=${created_unix_time}`)
			.subscribe({
				next: () => {
					this.getPipelines();
					this.showDeleteConfirmPipeline = false;
					this.pipelineToDelete = null;
				},
				error: (err) => console.error('Failed to delete pipeline', err)
			});
	}

	viewPipeline(pipeline: any) {
		this.viewMode = true;
		this.editMode = false;
		this.editingPipelineTime = null;

		this.pipelineName = pipeline.basic_details.name;
		this.baselineStart = pipeline.basic_details.baseline_period_start;
		this.baselineEnd = pipeline.basic_details.baseline_period_end;
		this.baselineUnit = pipeline.basic_details.baseline_units;
		this.Baseline = !!(this.baselineStart || this.baselineEnd);

		this.timeFeatures.forEach(feature => {
			feature.selected = pipeline.time_domain_features.features.includes(feature.name);
		});

		this.frequencyBands = Object.entries(pipeline.frequency_domain_features.frequency_bands).map(([label, range]) => {
			const typedRange = range as { lower: number; upper: number };
			return {
				label: label.charAt(0).toUpperCase() + label.slice(1),
				lower: typedRange.lower,
				upper: typedRange.upper,
				selected: true
			};
		});

		const power = pipeline.frequency_domain_features.band_power_estimation;
		this.epochDuration = power.epochs_per_duration;
		this.calculationMethod = power.calculation_method;
		this.rejectAnnotation = power.reject_by_annoatation;
		this.relativePower = power.relative_power;

		this.showExtract = false;
		this.showCreate = true;
		this.showCreateTab1 = true;
		this.showCreateTab2 = false;
		this.showCreateTab3 = false;
	}

	resetCreatePipelineForm() {
		// Reset pipeline creation/edit state
		this.editMode = false;
		this.viewMode = false;
		this.editingPipelineTime = null;

		// Step visibility
		this.showCreateTab1 = true;
		this.showCreateTab2 = false;
		this.showCreateTab3 = false;

		// Clear fields
		this.pipelineName = '';
		this.baselineStart = '';
		this.baselineEnd = '';
		this.baselineUnit = 'seconds';
		this.Baseline = false;
		this.epochDuration = 5;
		this.calculationMethod = 'Multitaper';
		this.rejectAnnotation = false;
		this.relativePower = false;

		// Uncheck time features
		this.timeFeatures.forEach(feature => feature.selected = false);
		this.selectAllTimeFeatures = false;

		// Reset default frequency bands
		this.frequencyBands = [
			{ label: 'Delta', lower: 0, upper: 4, selected: false },
			{ label: 'Theta', lower: 4, upper: 8, selected: false },
			{ label: 'Alpha', lower: 8, upper: 12, selected: false },
			{ label: 'Beta', lower: 12, upper: 30, selected: false }
		];

		// Hide the create form and return to extract view
		this.showCreate = false;
		this.showExtract = true;
	}

	promptDeleteFile(file: any) {
		this.fileToDelete = file;
		this.selectedFileName = file.filename;
		this.showDeleteConfirmFile = true;
	}

	cancelDeleteFile() {
		this.fileToDelete = null;
		this.showDeleteConfirmFile = false;
	}

	confirmDeleteFile() {
		if (!this.fileToDelete) return;

		const uid = this.fileToDelete.uid;
		this.fileList = this.fileList.filter(f => f.uid !== uid);
		this.file_data = this.file_data.filter((f: any) => f.uid !== uid);
		this.selectedFiles = this.selectedFiles.filter(id => id !== uid);

		// Adjust index if needed
		if (this.currentFileIdx >= this.file_data.length) {
			this.currentFileIdx = 0;
		}

		this.showDeleteConfirmFile = false;
		this.fileToDelete = null;
	}

	downloadExcelReport() {
		const currentKey = this.keys[this.selectedMainIdx];
		const currentTask = this.selectedTask;
		const currentChannel = this.selectedChannel;
		const currentResult = this.result[currentKey][currentTask][currentChannel];

		// Prepare Time Domain Features
		const timeData = Object.entries(currentResult.time_domain).map(([key, value]: [string, any]) => {
			return {
				Feature: key.replace('_', ' ').toUpperCase(),
				Value: value,
				Unit: this.getUnit(key)
			};
		});

		// Prepare Frequency Domain Features
		const freqData = currentResult.band_power.map(([band, value]: [string, number]) => {
			const label = band.charAt(0).toUpperCase() + band.slice(1);
			return {
				Band: label,
				Power: value,
				Unit: 'μV'
			};
		});

		const EXCEL_TYPE =
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';

		const workbook: XLSX.WorkBook = XLSX.utils.book_new();

		const timeSheet = XLSX.utils.json_to_sheet(timeData);
		XLSX.utils.book_append_sheet(workbook, timeSheet, 'Time Domain Features');

		const freqSheet = XLSX.utils.json_to_sheet(freqData);
		XLSX.utils.book_append_sheet(workbook, freqSheet, 'Frequency Domain Features');

		const filename = `${this.getCurrentFileName(currentKey)}_${currentTask}_${currentChannel}_Report.xlsx`;
		const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
		const data: Blob = new Blob([excelBuffer], { type: EXCEL_TYPE });
		FileSaver.saveAs(data, filename);
	}

}
