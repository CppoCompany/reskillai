import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class OnboardingComponent implements OnInit {
  userType: 'expert' | 'business' | null = null;
  loading = false;
  error = '';

  expert = {
    profession: '',
    years_experience: 0,
    bio: '',
    hourly_rate: null as number | null,
    availability: 'project_based' as 'project_based' | 'full_time' | 'part_time',
  };
  expertSkillsRaw = '';
  expertIndustriesRaw = '';
  expertLanguagesRaw = '';

  business = {
    company_name: '',
    industry: '',
    company_size: '1-10' as '1-10' | '11-50' | '51-200' | '200+',
    website: '',
    description: '',
    budget_range: 'under_1k' as 'under_1k' | '1k_5k' | '5k_20k' | '20k+',
  };
  businessNeedsRaw = '';

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    // Use userType passed directly from sign-up navigation state (avoids token race condition)
    const navState = history.state as { userType?: 'expert' | 'business' };
    if (navState?.userType) {
      this.userType = navState.userType;
    }

    await this.auth.waitForLoad();
    if (!this.auth.isSignedIn()) {
      this.router.navigate(['/sign-in']);
      return;
    }

    // Only call API if we don't already have userType from navigation state
    if (!this.userType) {
      this.userService.getMe().subscribe({
        next: user => { this.userType = user.user_type; },
        error: (e) => {
          this.error = e?.error?.detail ?? 'Could not load user profile';
        },
      });
    }
  }

  submitExpert(): void {
    this.loading = true;
    const payload = {
      ...this.expert,
      skills: this.expertSkillsRaw.split(',').map(s => s.trim()).filter(Boolean),
      industries: this.expertIndustriesRaw.split(',').map(s => s.trim()).filter(Boolean),
      languages: this.expertLanguagesRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
    this.userService.createExpertProfile(payload).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e: { message?: string }) => { this.error = e.message ?? 'Failed'; this.loading = false; },
    });
  }

  submitBusiness(): void {
    this.loading = true;
    const payload = {
      ...this.business,
      needs: this.businessNeedsRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
    this.userService.createBusinessProfile(payload).subscribe({
      next: () => this.router.navigate(['/publisher']),
      error: (e: { message?: string }) => { this.error = e.message ?? 'Failed'; this.loading = false; },
    });
  }
}
