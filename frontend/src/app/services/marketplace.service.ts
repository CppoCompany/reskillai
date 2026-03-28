import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ExpertProfile {
  id: string;
  full_name: string | null;
  profession: string;
  years_experience: number;
  skills: string[];
  industries: string[];
  hourly_rate: number | null;
  availability: string;
  bio: string | null;
  ai_risk_score: number | null;
}

export interface JobPost {
  id: string;
  title: string;
  description: string;
  required_profession: string;
  required_skills: string[];
  required_experience: number;
  budget_type: string;
  budget_amount: number;
  duration: string;
  location_type: string;
  status: string;
  views_count: number;
  created_at: string;
}

export interface JobPostCreate {
  title: string;
  description: string;
  required_profession: string;
  required_skills: string[];
  required_experience: number;
  budget_type: 'hourly' | 'fixed' | 'monthly';
  budget_amount: number;
  duration: 'one_time' | 'short_term' | 'long_term' | 'ongoing';
  location_type: 'remote' | 'onsite' | 'hybrid';
}

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  constructor(private api: ApiService) {}

  getExperts(skills?: string, profession?: string): Observable<ExpertProfile[]> {
    const params = new URLSearchParams();
    if (skills) params.set('skills', skills);
    if (profession) params.set('profession', profession);
    const qs = params.toString();
    return this.api.get<ExpertProfile[]>('/marketplace/experts' + (qs ? '?' + qs : ''));
  }

  getJobs(skills?: string, profession?: string): Observable<JobPost[]> {
    const params = new URLSearchParams();
    if (skills) params.set('skills', skills);
    if (profession) params.set('profession', profession);
    const qs = params.toString();
    return this.api.get<JobPost[]>('/marketplace/jobs' + (qs ? '?' + qs : ''));
  }

  postJob(data: JobPostCreate): Observable<JobPost> {
    return this.api.post<JobPost>('/marketplace/jobs', data);
  }
}
