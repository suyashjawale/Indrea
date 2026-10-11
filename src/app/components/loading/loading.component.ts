import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
	selector: 'app-loading',
	imports: [],
	templateUrl: './loading.component.html',
	styleUrl: './loading.component.css'
})
export class LoadingComponent {

	constructor(private http: HttpClient, private router: Router) {
		this.sleep(1).then(() => { this.checkServerStatus(); });
	}

	sleep(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	private async checkServerStatus(retries = 10, delay = 2000): Promise<void> {
		for (let i = 0; i < retries; i++) {
			try {
				await this.http.get('http://127.0.0.1:8000/').toPromise();
				this.router.navigate(['/home']);
				return;
			} catch {
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
		this.router.navigate(['/server-down']);
	}

}
