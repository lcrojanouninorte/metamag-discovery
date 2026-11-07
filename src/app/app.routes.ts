import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { SessionComponent } from './pages/session.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'session/:id/:view', component: SessionComponent },
  { path: 'session/:id', redirectTo: 'session/:id/interview', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
