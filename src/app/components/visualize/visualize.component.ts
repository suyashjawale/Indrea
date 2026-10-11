import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import pako from 'pako';  // For decompressing Gzip
import * as numpyParser from 'numpy-parser';
import JSZip from 'jszip';
import { CommonModule } from '@angular/common';
declare var bootstrap: any;
declare let Plotly: any;

interface log {
	date: string
	time: string,
	action: string,
	params: { key: string, value: string }[]
}

interface description {
	uid: number,
	colour: string,
	name: string,
	editable: boolean,
	tempValue: string,
	tempColour: string
}

@Component({
	selector: 'app-visualize',
	imports: [FormsModule, CommonModule],
	templateUrl: './visualize.component.html',
	styleUrls: ['./visualize.component.css'],
})

export class VisualizeComponent {
	channels: string[] = [];
	mappings: number[][] = [];
	times: number[] = [];
	filterType: string = "bpass";
	lreq: number | undefined;
	hreq: number | undefined;
	logs: log[] = [];
	loading: boolean = false;
	maxTime: number = 0;
	mode: string = "pan";
	icaApplied: boolean = false;
	n_comp: number | undefined;
	max_iter: number | undefined;
	random_state: number | undefined;
	isFilterEverApplied: boolean = false;
	icaExcluded: boolean = false;
	expandTopo: boolean = false;
	spectralFreq: number[] = [];
	spectralPos: number[][] = [];
	timeSeriesPos: number[][] = [];
	timeSeriesTime: number[] = [];
	windowSize = 500;
	rejectedIdx: string = "";
	shapes: any[] = [];
	aggregatedView: boolean = true;
	totalHeight: number = 600;
	aggregatedViewHeight: number = 600;
	expandedViewHeight: number = 600;
	heightPerChannel: number = 200;
	fixedRange: boolean = true;
	hide: boolean = false;
	dummy: description = {
		colour: '#ff0000',
		editable: false,
		name: "Bad Signal",
		tempValue: "Bad Signal",
		uid: 1,
		tempColour: "#ff0000"
	};
	annotationError: boolean = false;
	selectedDescription: description = this.dummy;
	preSelectedIdx: string = "";
	descriptions: description[] = [
		this.dummy
	];

	annotateFlag: boolean = false;
	descValue: string = '';
	colourInput: string = "#00fbff";

	constructor(private http: HttpClient, private router: Router) {
		const navigation = this.router.getCurrentNavigation();
		this.channels = navigation?.extras.state?.['channels'] || [];
		this.mappings = navigation?.extras.state?.['mappings'] || [];
		this.times = navigation?.extras.state?.['times'] || [];
	}

	ngOnInit() {
		this.loading = true;
		const div: any = document.getElementById('signalViewer');
		this.aggregatedViewHeight = div.clientHeight;
		this.expandedViewHeight = Math.max(this.channels.length * this.heightPerChannel, this.aggregatedViewHeight);
		this.totalHeight = this.aggregatedViewHeight;
		this.plot(this.mappings, this.times);
		this.loading = false;
	}

	addDescription() {
		this.descriptions.push({
			colour: this.colourInput,
			name: this.descValue,
			editable: false,
			tempColour: this.colourInput,
			tempValue: this.descValue,
			uid: Date.now()
		});
	}

	refresh() {
		this.loading = true;
		this.sleep(1).then(() => {
			this.plot(this.mappings, this.times);
			this.loading = false;
		});
	}

	editDescription(ind: number) {
		for (let i = 0; i < this.shapes.length; i++) {
			if (this.shapes[i].uid == this.descriptions[ind].uid) {
				this.shapes[i].descriptionName = this.descriptions[ind].tempValue;
				const red = parseInt(this.descriptions[ind].tempColour.substring(1, 3), 16);
				const green = parseInt(this.descriptions[ind].tempColour.substring(3, 5), 16);
				const blue = parseInt(this.descriptions[ind].tempColour.substring(5, 7), 16);
				this.shapes[i].fillcolor = `rgba(${red}, ${green}, ${blue},0.2)`;
			}
		}
		this.descriptions[ind].name = this.descriptions[ind].tempValue;
		if (this.descriptions[ind].colour != this.descriptions[ind].tempColour) {
			const div: any = document.getElementById('signalViewer');
			this.descriptions[ind].colour = this.descriptions[ind].tempColour;
			Plotly.relayout(div, { shapes: [...this.shapes] });
		}
		this.descriptions[ind].editable = false;
	}

	deleteDescription(ind: number) {
		this.shapes = this.shapes.filter(e => e.uid !== this.descriptions[ind].uid)
		this.descriptions.splice(ind, 1);
		const div: any = document.getElementById('signalViewer');
		Plotly.relayout(div, { shapes: [...this.shapes] });
		if (this.descriptions.length == 0) {
			this.mode = 'pan';
			const div = document.getElementById('signalViewer');
			Plotly.relayout(div, { dragmode: 'pan' });
		}
	}

	deleteAnnotation(ind: number) {
		this.shapes.splice(ind, 1);
		const div: any = document.getElementById('signalViewer');
		Plotly.relayout(div, { shapes: [...this.shapes] });
	}

	annotateBadSegment(start: number, end: number) {
		console.log(`Send to FastAPI: Annotate from ${start}s to ${end}s`);
	}

	plot(mappings: number[][], times: number[]) {
		const div: any = document.getElementById('signalViewer');
		if (!div) return;
		const traces = [];
		const totalChannels = mappings.length;
		this.maxTime = Math.max(...times);
		div.style.minHeight = `${this.totalHeight}px`;
		div.style.height = `${this.totalHeight}px`;

		for (let i = 0; i < totalChannels; i++) {
			traces.push({
				x: times,
				y: mappings[i],
				type: 'scatter',
				mode: 'lines',
				name: this.channels[i] || `Ch ${i + 1}`,
				xaxis: 'x',
				yaxis: 'y' + (i === 0 ? '' : i + 1),
				line: { width: 1 },
			});
		}

		const layout: any = {
			autosize: true,
			margin: { l: 50, r: 20, t: 30, b: 4 },
			showlegend: false,
			height: this.totalHeight,
			dragmode: this.mode,
			shapes: [...this.shapes],
			xaxis: {
				title: 'Time (s)',
				domain: [0, 1],
				anchor: 'y' + totalChannels,
				rangeslider: { visible: true, thickness: 0.05 },
				range: [0, this.maxTime],
			}
		};

		for (let i = 0; i < totalChannels; i++) {
			const axisName = 'yaxis' + (i === 0 ? '' : i + 1);
			layout[axisName] = {
				domain: [1 - (i + 1) / totalChannels, 1 - i / totalChannels],
				title: {
					text: this.channels[i] || `Ch ${i + 1}`,
					font: { size: 10 },
				},
				showticklabels: false,
				fixedrange: this.fixedRange,
			};
		}

		const config = {
			responsive: true,
			scrollZoom: true,
			displaylogo: false,
			modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'toImage', 'resetScale2d'],
			displayModeBar: true
		};

		Plotly.newPlot(div, traces, layout, config).then(() => {
			div.on('plotly_selected', (event: any) => {
				if (event?.range?.x) {
					let [start, end] = event.range.x;
					start = start.toFixed(3);
					end = end.toFixed(3);
					const red = parseInt(this.selectedDescription.colour.substring(1, 3), 16);
					const green = parseInt(this.selectedDescription.colour.substring(3, 5), 16);
					const blue = parseInt(this.selectedDescription.colour.substring(5, 7), 16);
					if (start >= 0 && end <= this.maxTime) {
						const shape = {
							type: 'rect',
							xref: 'x',
							yref: 'paper',
							x0: start,
							x1: end,
							y0: 0,
							y1: 1,
							fillcolor: `rgba(${red}, ${green}, ${blue},0.2)`,
							line: { width: 0 },
							descriptionName: this.selectedDescription.name,
							uid: this.selectedDescription.uid,
							isApplied: false
						};
						this.shapes.push(shape);

						this.shapes.sort((a, b) => a.x0 - b.x0)

						layout.shapes = [...this.shapes];

						Plotly.relayout(div, { shapes: layout.shapes });

						this.annotateBadSegment(start, end);
					}
					else {
						alert("Selection not within acceptable range");
					}
				}
			});
		});
	}

	applyAnnotation() {
		this.loading = true;
		this.annotationError = false;
		const onset = this.shapes.map((e) => e.x0);
		const duration = this.shapes.map((e) => (e.x1 - e.x0).toFixed(3));
		const description = this.shapes.map((e) => e.descriptionName);
		let log: log = {
			date: new Date().toDateString(),
			time: new Date().toLocaleTimeString(),
			action: "Annotate Signal",
			params: []
		};
		this.http.post('http://localhost:8000/apply-annotations', { "onset": onset, "duration": duration, "description": description })
			.subscribe({
				next: (response) => {
					for (let i = 0; i < this.shapes.length; i++) {
						this.shapes[i].isApplied = true;
						log.params.push({ key: 'Start', value: this.shapes[i].x0 });
						log.params.push({ key: 'End', value: this.shapes[i].x1 });
						log.params.push({ key: 'Description', value: this.shapes[i].descriptionName });
						log.params.push({ key: "____", value: "____" });
					}
					this.logs.push(log);
					this.loading = false;
				},
				error: (err) => {
					this.annotationError = true;
					this.loading = false;
				}
			});
	}

	changeView() {
		this.loading = true;
		this.sleep(1).then(() => {
			const div: any = document.getElementById('signalViewer');
			this.totalHeight = this.aggregatedView ? this.aggregatedViewHeight : this.expandedViewHeight;
			Plotly.relayout(div, { height: this.totalHeight }).then(() => this.loading = false);
		});
	}

	openInNewTab(routeNames: string[]) {
		for (let x of routeNames) {
			window.open(this.router.serializeUrl(this.router.createUrlTree([`/${x}`])), '_blank');
		}
	}

	setAnnotateMode() {
		if (this.annotateFlag) {
			this.setMode('select');
		}
		else {
			this.setMode('pan');
		}
	}

	setMode(mode: string) {
		if (mode != 'select')
			this.annotateFlag = false;
		this.mode = mode;
		const div = document.getElementById('signalViewer');
		if (div) {
			Plotly.relayout(div, { dragmode: mode });
		}
	}

	download() {
		const div = document.getElementById('signalViewer');
		if (div) {
			Plotly.downloadImage(div, { format: 'png', filename: 'Signal_Viewer_Plot' });
		}
	}

	resizeWindow() {
		this.loading = true;
		this.sleep(350).then(() => {
			this.plot(this.mappings, this.times);
			this.loading = false;
		});
	}

	sleep(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	back() {
		this.router.navigate(['/upload-edf']);
	}

	applyFilter() {
		this.loading = true;
		let log: log = {
			date: new Date().toDateString(),
			time: new Date().toLocaleTimeString(),
			action: this.filterType == "bpass" ? "Band Pass" : this.filterType == "lpass" ? "Low Pass" : "High Pass",
			params: []
		};

		const formData = new FormData();

		if (this.filterType == 'bpass' || this.filterType == 'hpass') {
			formData.append('l_freq', String(this.lreq));
			log.params.push({ key: 'Lower Cut Off', value: String(this.lreq) });
		}
		if (this.filterType == 'bpass' || this.filterType == 'lpass') {
			formData.append('h_freq', String(this.hreq));
			log.params.push({ key: 'Higher Cut Off', value: String(this.hreq) });
		}


		this.http.post('http://localhost:8000/apply-filter', formData, { responseType: 'arraybuffer' })
			.subscribe({
				next: async (compressedResponse: ArrayBuffer) => {
					const data = await this.processResponse(compressedResponse);
					let matrix = data['data.npy'].data;
					let shape = data['data.npy'].shape;
					this.mappings = this.get2dArray(matrix, shape);
					this.plot(this.mappings, this.times);
					this.logs.push(log);
					this.loading = false;
					if (this.filterType == 'hpass' || this.filterType == 'bpass') {
						this.isFilterEverApplied = true;
					}
				},
				error: (err) => {
					console.error('❌ Upload failed:', err);
					this.loading = false;
				}
			});
	}



	applyIca() {
		this.loading = true;
		let log: log = {
			date: new Date().toDateString(),
			time: new Date().toLocaleTimeString(),
			action: "Apply ICA",
			params: []
		};

		const formData = new FormData();

		formData.append('n_components', String(this.n_comp));
		log.params.push({ key: 'No. of Components', value: String(this.n_comp) });

		formData.append('random_state', String(this.random_state));
		log.params.push({ key: 'Random State', value: String(this.random_state) });

		formData.append('max_iter', String(this.max_iter));
		log.params.push({ key: 'Max Iteration', value: String(this.max_iter) });

		if (this.isFilterEverApplied) {
			this.http.post('http://localhost:8000/apply-ica', formData, { responseType: 'blob' })
				.subscribe({
					next: (blob: Blob) => {
						const url = URL.createObjectURL(blob);
						this.logs.push(log);

						this.http.get<{ muscle_idx: number[] }>('http://localhost:8000/get-mai')
							.subscribe({
								next: (response) => {
									for (let x of response['muscle_idx']) {
										this.preSelectedIdx += `${x}, `;
									}
								},
								error: (err) => {
									console.log("ee");
								}
							});

						sessionStorage.setItem('topoData', JSON.stringify({ topoImage: url }));
						this.openInNewTab(['topo', 'spectral', 'timeseries']);
						this.icaApplied = true;
						this.loading = false;
					},
					error: (err) => {
						const reader = new FileReader();
						reader.onload = () => {
							const json = JSON.parse(reader.result as string);
							// this.topoPlotUrl = json.error;
						};
						reader.readAsText(err.error);
						this.loading = false;
					}
				});

		}
		else {
			this.loading = false;
		}
	}

	resetIca() {
		this.icaApplied = false;
		this.icaExcluded = false;
		this.rejectedIdx = "";
	}

	rejectIca() {
		this.loading = true;
		let idx = this.rejectedIdx.split(",");
		let muscle_idx = [];
		for (let i = 0; i < idx.length; i++) {
			muscle_idx.push(Number(idx[i].trim()));
		}

		this.http.post('http://localhost:8000/rejectICA', muscle_idx)
			.subscribe({
				next: (response) => {
					let log: log = {
						date: new Date().toDateString(),
						time: new Date().toLocaleTimeString(),
						action: "Exclude ICA",
						params: []
					};
					log.params.push({ key: 'Muscle Artifact Indices', value: this.preSelectedIdx });
					log.params.push({ key: 'Excluded Components', value: this.rejectedIdx });
					this.logs.push(log);

					this.http.get('http://localhost:8000/get-signal', { responseType: 'arraybuffer' })
						.subscribe({
							next: async (compressedResponse: ArrayBuffer) => {
								const data = await this.processResponse(compressedResponse);
								let matrix = data['data.npy'].data;
								let shape = data['data.npy'].shape;
								this.mappings = this.get2dArray(matrix, shape);
								this.plot(this.mappings, this.times);
								this.icaExcluded = true;
								this.loading = false;
							},
							error: (err) => {
								console.error('❌ Get Signal:', err);
								this.loading = false;
							}
						});
				},
				error: (err) => {
					console.log("Failed to Reject ICA");
				}
			});
	}

	generateLogText(logs: log[]): string {
		return logs.map(entry => {
			const params = entry.params.map(p => `${p.key} : ${p.value}`).join('\n');
			return `${entry.date}\n${entry.time}\nAction : ${entry.action}\nParams ↓\n${params}\n------------------------------`;
		}).join('\n');
	}

	downloadLogsAsTxt() {
		const logText = this.generateLogText(this.logs);
		const blob = new Blob([logText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'Brasig_logs.txt';
		a.click();
		URL.revokeObjectURL(url);
	}

	exportRawObject() {
		const extension = Date.now().toString();
		const fileName = `raw_${extension}`;
		const url = `http://localhost:8000/save-raw-file`;
		const a = document.createElement('a');
		a.href = url;
		a.download = `${fileName}.fif`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
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
