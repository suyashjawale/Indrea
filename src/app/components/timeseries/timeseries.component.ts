import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import pako from 'pako';  // For decompressing Gzip
import * as numpyParser from 'numpy-parser';
import JSZip from 'jszip';
declare let Plotly: any;

@Component({
	selector: 'app-timeseries',
	imports: [],
	templateUrl: './timeseries.component.html',
	styleUrl: './timeseries.component.css'
})

export class TimeseriesComponent {
	timeSeriesPos: number[][] = [];
	timeSeriesTime: number[] = [];
	aggregatedViewHeight: number = 600;
	loading: boolean = true;
	constructor(private http: HttpClient) {
	}

	ngOnInit() {
		const div: any = document.getElementById('icaTimeseries');
		this.aggregatedViewHeight = div.clientHeight;
		this.http.get('http://localhost:8000/ica-timeseries', { responseType: 'arraybuffer' })
			.subscribe({
				next: async (compressedResponse: ArrayBuffer) => {

					const data = await this.processResponse(compressedResponse);
					this.timeSeriesTime = data['times.npy'].data;
					let matrix = data['data.npy'].data;
					let shape = data['data.npy'].shape;
					this.timeSeriesPos = this.get2dArray(matrix, shape);
					this.plotIcaTimeseries(this.timeSeriesPos, this.timeSeriesTime);
					this.loading = false;
				},
				error: (err) => {
					console.error('Loading failed:', err);
				}
			});
	}

	// plotIcaTimeseries(sources: number[][], times: number[]) {
	// 	const nComponents = sources.length;
	// 	const offsetStep = 20;  // Adjust as needed for vertical spacing

	// 	const traces = sources.map((component, idx) => {
	// 		const offset = offsetStep * (nComponents - idx); // top component has highest y-offset
	// 		const shiftedY = component.map(val => val + offset);

	// 		return {
	// 			x: times,
	// 			y: shiftedY,
	// 			type: 'scatter',
	// 			mode: 'lines',
	// 			name: `ICA${idx.toString().padStart(3, '0')}`,
	// 			line: { width: 1 },
	// 			hoverinfo: 'x+y+name'
	// 		};
	// 	});

	// 	const layout: any = {
	// 		title: 'ICA Components (Overlapping Like MNE)',
	// 		// height: nComponents * 100,
	// 		height : this.aggregatedViewHeight,
	// 		margin: { l: 60, r: 20, t: 30, b: 40 },
	// 		yaxis: {
	// 			showticklabels: false,
	// 			zeroline: false
	// 		},
	// 		xaxis: {
	// 			title: 'Time (s)'
	// 		},
	// 		showlegend: false,
	// 		hovermode: 'closest'
	// 	};

	// 	const config = {
	// 		responsive: true,
	// 		scrollZoom: true,
	// 		displaylogo: false
	// 	};

	// 	Plotly.newPlot('icaTimeseries', traces, layout, config);
	// }


	// plotIcaTimeseries(sources: number[][], times: number[]) {
	// 	const nComponents = sources.length;
	// 	const offsetStep = 20; // Vertical space between traces

	// 	const traces = sources.map((component, idx) => {
	// 		const offset = offsetStep * (nComponents - idx); // Higher index = lower on screen
	// 		const shiftedY = component.map(val => val + offset);
	// 		return {
	// 			x: times,
	// 			y: shiftedY,
	// 			type: 'scatter',
	// 			mode: 'lines',
	// 			line: { width: 1 },
	// 			name: `ICA${idx.toString().padStart(3, '0')}`,
	// 			hoverinfo: 'x+y+name',
	// 			showlegend: false
	// 		};
	// 	});

	// 	// Annotations for each component label
	// 	const annotations = sources.map((_, idx) => {
	// 		const offset = offsetStep * (nComponents - idx);
	// 		return {
	// 			x: times[0],           // Left-most x position
	// 			y: offset,             // Match y-offset of the trace
	// 			xref: 'x',
	// 			yref: 'y',
	// 			text: `ICA${idx.toString().padStart(3, '0')} `,
	// 			showarrow: false,
	// 			font: {
	// 				color: 'black',
	// 				size: 12
	// 			},
	// 			xanchor: 'right',
	// 			align: 'right'
	// 		};
	// 	});

	// 	const layout: any = {
	// 		title: 'ICA Components (MNE-like Overlapping)',
	// 		height : this.aggregatedViewHeight,
	// 		margin: { l: 80, r: 20, t: 30, b: 40 },
	// 		xaxis: {
	// 			title: 'Time (s)',
	// 			showgrid: true,
	// 			// zeroline: false
	// 		},
	// 		yaxis: {
	// 			showticklabels: false,
	// 			showgrid: false,
	// 			// zeroline: false
	// 		},
	// 		hovermode: 'closest',
	// 		annotations: annotations
	// 	};

	// 	const config = {
	// 		responsive: true,
	// 		scrollZoom: true,
	// 		displaylogo: false
	// 	};

	// 	Plotly.newPlot('icaTimeseries', traces, layout, config);
	// }


	// ------------------------------------------
	// plotIcaTimeseries(sources: number[][], times: number[]) {
	// 	const nComponents = sources.length;
	// 	const offsetStep = 20;

	// 	const yOffsets = Array.from({ length: nComponents }, (_, i) => i * offsetStep);
	// 	const traces = sources.map((component, idx) => {
	// 		const shiftedY = component.map(val => val + yOffsets[idx]);
	// 		return {
	// 			x: times,
	// 			y: shiftedY,
	// 			type: 'scatter',
	// 			mode: 'lines',
	// 			line: { width: 1 },
	// 			name: `ICA${idx.toString().padStart(3, '0')}`,
	// 			hoverinfo: 'x+y+name',
	// 			showlegend: false
	// 		};
	// 	});

	// 	const layout: any = {
	// 		title: 'ICA Components (MNE-like Overlapping)',
	// 		height: this.aggregatedViewHeight,
	// 		margin: { l: 100, r: 20, t: 30, b: 40 },
	// 		xaxis: {
	// 			title: 'Time (s)',
	// 			showgrid: true,
	// 			rangeslider: { visible: true },
	// 			fixedrange: false
	// 		},
	// 		yaxis: {
	// 			title: '',
	// 			showgrid: false,
	// 			tickvals: yOffsets,
	// 			ticktext: yOffsets.map((_, idx) => `ICA${idx.toString().padStart(3, '0')} `),
	// 			fixedrange: true,
	// 			automargin: true
	// 		},
	// 		hovermode: 'closest'
	// 	};

	// 	const config = {
	// 		responsive: true,
	// 		scrollZoom: true,
	// 		displaylogo: false
	// 	};

	// 	Plotly.newPlot('icaTimeseries', traces, layout, config);
	// }

	// ---------------------------------------------

	plotIcaTimeseries(sources: number[][], times: number[]) {
		const nComponents = sources.length;
		const offsetStep = 20;

		// ICA000 at top, ICA00X below
		const yOffsets = Array.from({ length: nComponents }, (_, i) => i * offsetStep);

		const traces = sources.map((component, idx) => {
			const shiftedY = component.map(val => val + yOffsets[idx]);
			return {
				x: times,
				y: shiftedY,
				type: 'scatter',
				mode: 'lines',
				line: { width: 1 },
				name: `ICA${idx.toString().padStart(3, '0')}`,
				hoverinfo: 'x+y+name',
				showlegend: false
			};
		});

		const layout: any = {
			title: 'ICA Components (MNE-style Top-Down)',
			height: this.aggregatedViewHeight,
			margin: { l: 50, r: 20, t: 10, b: 10 },
			dragmode: 'pan',
			xaxis: {
				title: 'Time (s)',
				showgrid: true,
				rangeslider: { visible: true },
				fixedrange: false
			},
			yaxis: {
				title: '',
				showgrid: false,
				tickvals: yOffsets,
				ticktext: yOffsets.map((_, idx) => `ICA${idx.toString().padStart(3, '0')} `),
				autorange: 'reversed',  // Important: this flips the y-axis so ICA000 is visually at top
				fixedrange: true,
				automargin: true
			},
			hovermode: 'closest'
		};

		const config = {
			responsive: true,
			scrollZoom: true,
			displaylogo: false
		};

		Plotly.newPlot('icaTimeseries', traces, layout, config);
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
