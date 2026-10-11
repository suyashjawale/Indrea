import { Component } from '@angular/core';

@Component({
	selector: 'app-topo',
	imports: [],
	templateUrl: './topo.component.html',
	styleUrl: './topo.component.css'
})

export class TopoComponent {
	topoPlotUrl : string ='';
	loading : boolean = true;
	ngOnInit() {
		const data = sessionStorage.getItem('topoData');
		if (data) {
			const {topoImage} = JSON.parse(data);
			this.topoPlotUrl = topoImage;
			this.loading = false;
		}
	}
}
