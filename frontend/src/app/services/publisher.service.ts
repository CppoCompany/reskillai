import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PositionDraft {
  title: string;
  description: string;
  required_skills: string[];
  required_experience: number;
  education_level: string;
  location?: string;
  work_type: 'remote' | 'onsite' | 'hybrid';
  employment_type: 'full_time' | 'part_time' | 'contract' | 'freelance';
  salary_min?: number | null;
  salary_max?: number | null;
}

export interface PositionReviewOutput {
  approved: boolean;
  issues: string[];
  suggestions: string[];
}

export interface Position extends PositionDraft {
  id: string;
  user_id: string;
  status: 'open' | 'closed';
  ai_review?: PositionReviewOutput | null;
  match_count: number;
  created_at: string;
  updated_at: string;
}

export interface PositionMatch {
  id: string;
  match_score: number;
  match_explanation: string;
  matched_skills: string[];
  years_experience: number;
  current_industry: string;
  education_level: string;
  risk_level: string;
  is_relevant?: boolean | null;
  comment?: string | null;
}

export interface BusinessProfile {
  id?: string;
  user_id?: string;
  company_name: string;
  industry: string;
  company_size: '1-10' | '11-50' | '51-200' | '200+';
  website?: string;
  description?: string;
  location?: string;
  needs: string[];
  budget_range: 'under_1k' | '1k_5k' | '5k_20k' | '20k+';
}

export interface PublisherProfile {
  user: { id: string; email: string; full_name?: string; plan: string; created_at: string };
  business: BusinessProfile | null;
}

@Injectable({ providedIn: 'root' })
export class PublisherService {
  constructor(private api: ApiService) {}

  reviewPosition(draft: PositionDraft): Observable<PositionReviewOutput> {
    return this.api.post<PositionReviewOutput>('/publisher/review', draft);
  }

  createPosition(draft: PositionDraft): Observable<Position & { matches: PositionMatch[] }> {
    return this.api.post<Position & { matches: PositionMatch[] }>('/publisher/positions', draft);
  }

  getPositions(): Observable<Position[]> {
    return this.api.get<Position[]>('/publisher/positions');
  }

  getPosition(id: string): Observable<Position> {
    return this.api.get<Position>(`/publisher/positions/${id}`);
  }

  getMatches(positionId: string): Observable<PositionMatch[]> {
    return this.api.get<PositionMatch[]>(`/publisher/positions/${positionId}/matches`);
  }

  updatePosition(id: string, draft: PositionDraft): Observable<Position & { matches: PositionMatch[] }> {
    return this.api.put<Position & { matches: PositionMatch[] }>(`/publisher/positions/${id}`, draft);
  }

  rematch(positionId: string): Observable<{ matches: PositionMatch[] }> {
    return this.api.post<{ matches: PositionMatch[] }>(`/publisher/positions/${positionId}/rematch`, {});
  }

  updateStatus(positionId: string, status: 'open' | 'closed'): Observable<Position> {
    return this.api.patch<Position>(`/publisher/positions/${positionId}/status`, { status });
  }

  updateMatchFeedback(positionId: string, matchId: string, feedback: { is_relevant?: boolean | null; comment?: string }): Observable<any> {
    return this.api.patch<any>(`/publisher/positions/${positionId}/matches/${matchId}/feedback`, feedback);
  }

  getProfile(): Observable<PublisherProfile> {
    return this.api.get<PublisherProfile>('/publisher/profile');
  }

  updateBusinessProfile(data: Partial<BusinessProfile>): Observable<BusinessProfile> {
    return this.api.put<BusinessProfile>('/users/me/business-profile', data);
  }
}
