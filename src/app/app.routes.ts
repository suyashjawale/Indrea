import { Routes } from '@angular/router';
import { LoadingComponent } from './components/loading/loading.component';
import { HomepageComponent } from './components/homepage/homepage.component';

export const routes: Routes = [
    {
        path: '',
        component: LoadingComponent
    },
    {
        path: 'server-down',
        loadComponent: () => import('./components/server-down/server-down.component').then(mod => mod.ServerDownComponent)
    },
    {
        path: 'upload-edf',
        loadComponent: () => import('./components/upload/upload.component').then(mod => mod.UploadComponent)
    },
    {
        path: 'select-channel',
        loadComponent: () => import('./components/channel-select/channel-select.component').then(mod => mod.ChannelSelectComponent)
    },
    {
        path: 'visualize',
        loadComponent: () => import('./components/visualize/visualize.component').then(mod => mod.VisualizeComponent)
    },
    {
        path: 'spectral',
        loadComponent: () => import('./components/spectral/spectral.component').then(mod => mod.SpectralComponent)
    },
    {
        path: 'topo',
        loadComponent: () => import('./components/topo/topo.component').then(mod => mod.TopoComponent)
    },
    {
        path: 'timeseries',
        loadComponent: () => import('./components/timeseries/timeseries.component').then(mod => mod.TimeseriesComponent)
    },
    {
        path: 'upload-video',
        loadComponent : () => import('./components/upload-video/upload-video.component').then(mod=>mod.UploadVideoComponent)
    },
    {
        path: 'home',
        loadComponent : () => import('./components/homepage/homepage.component').then(mod=>mod.HomepageComponent)
    },
    {
        path: 'process',
        loadComponent : () => import('./components/process/process.component').then(mod=>mod.ProcessComponent)
    },
    {
        path: 'process-tab',
        loadComponent : () => import('./components/process-tab/process-tab.component').then(mod=>mod.ProcessTabComponent)
    },
    {
        path: 'upload-fif',
        loadComponent : () => import('./components/upload-fif/upload-fif.component').then(mod=>mod.UploadFifComponent)
    },
    {
        path: 'select-fif-channel',
        loadComponent : () => import('./components/select-fif-channel/select-fif-channel.component').then(mod=>mod.SelectFifChannelComponent)
    },
    // {
    //     path: '**',
    //     redirectTo: 'home'
    // },
];
