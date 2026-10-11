import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-homepage',
  imports: [MatTooltipModule],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.css'
})
export class HomepageComponent {

  recentProjects = [
    { name: 'Eeg_experiment_1', recent: '2 days ago', size: '5 MB', type: 'Single' },
    { name: 'Cognitive_analysis', recent: '4 days ago', size: '2 MB', type: 'Single' },
    { name: 'Data_viz_eeg', recent: '1 month ago', size: '104 MB', type: 'Batch' },
    { name: 'Eeg_experiment_2', recent: '2 months ago', size: '67 MB', type: 'Single' }
  ];

 constructor(private router: Router) {}

  startProcess(type: string) {
    this.router.navigate([type]);
  }

}
