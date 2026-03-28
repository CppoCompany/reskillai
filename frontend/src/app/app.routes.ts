import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.LandingComponent) },
  { path: 'sign-in', loadComponent: () => import('./pages/sign-in/sign-in').then(m => m.SignInComponent) },
  { path: 'sign-up', loadComponent: () => import('./pages/sign-up/sign-up').then(m => m.SignUpComponent) },
  { path: 'onboarding', loadComponent: () => import('./pages/onboarding/onboarding').then(m => m.OnboardingComponent), canActivate: [authGuard] },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent), canActivate: [authGuard] },
  { path: 'assessment', loadComponent: () => import('./pages/assessment/assessment').then(m => m.AssessmentComponent), canActivate: [authGuard] },
  { path: 'marketplace', loadComponent: () => import('./pages/marketplace/marketplace').then(m => m.MarketplaceComponent), canActivate: [authGuard] },
  { path: 'cv-builder', loadComponent: () => import('./pages/cv-builder/cv-builder').then(m => m.CvBuilderComponent), canActivate: [authGuard] },
  { path: 'trainings', loadComponent: () => import('./pages/trainings/trainings').then(m => m.TrainingsComponent), canActivate: [authGuard] },
  { path: 'lesson', loadComponent: () => import('./pages/lesson/lesson').then(m => m.LessonComponent), canActivate: [authGuard] },
  { path: 'publisher', loadComponent: () => import('./pages/publisher/publisher').then(m => m.PublisherComponent), canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
