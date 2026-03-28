import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface UserProfile {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string | null;
  user_type: 'expert' | 'business';
  plan: string;
  created_at: string;
  expert_profile?: Record<string, unknown>;
  business_profile?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  readonly currentUser = signal<UserProfile | null>(null);

  constructor(private api: ApiService) {}

  register(payload: {
    clerk_id: string;
    email: string;
    full_name: string;
    user_type: 'expert' | 'business';
  }): Observable<UserProfile> {
    return this.api.post<UserProfile>('/auth/register', payload).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  getMe(): Observable<UserProfile> {
    return this.api.get<UserProfile>('/users/me').pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  createExpertProfile(data: Record<string, unknown>): Observable<unknown> {
    return this.api.post('/users/me/expert-profile', data);
  }

  createBusinessProfile(data: Record<string, unknown>): Observable<unknown> {
    return this.api.post('/users/me/business-profile', data);
  }

  updateMe(data: { full_name?: string; avatar_url?: string }): Observable<UserProfile> {
    return this.api.patch<UserProfile>('/users/me', data).pipe(
      tap(user => this.currentUser.set(user))
    );
  }
}
