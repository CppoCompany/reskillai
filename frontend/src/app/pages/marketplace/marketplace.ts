import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService, UserProfile } from '../../services/user.service';
import { MarketplaceService, ExpertProfile, JobPost, JobPostCreate } from '../../services/marketplace.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-marketplace',
  imports: [FormsModule, RouterLink, NavbarComponent],
  templateUrl: './marketplace.html',
  styleUrl: './marketplace.scss',
})
export class MarketplaceComponent implements OnInit {
  user = signal<UserProfile | null>(null);
  experts = signal<ExpertProfile[]>([]);
  jobs = signal<JobPost[]>([]);
  loading = signal(true);
  error = signal('');

  // Filters (two-way bound via ngModel — plain properties are fine for inputs)
  skillsFilter = '';
  professionFilter = '';

  // Job post modal
  showPostModal = signal(false);
  postLoading = signal(false);
  postError = signal('');
  postSuccess = signal(false);

  newJob: JobPostCreate = {
    title: '',
    description: '',
    required_profession: '',
    required_skills: [],
    required_experience: 1,
    budget_type: 'hourly',
    budget_amount: 0,
    duration: 'short_term',
    location_type: 'remote',
  };
  requiredSkillsRaw = '';

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private marketplace: MarketplaceService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.waitForLoad();
    if (!this.auth.isSignedIn()) {
      this.router.navigate(['/sign-in']);
      return;
    }
    this.userService.getMe().subscribe({
      next: user => {
        this.user.set(user);
        this.loadData();
      },
      error: () => this.router.navigate(['/sign-in']),
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');

    if (this.user()?.user_type === 'business') {
      this.marketplace.getExperts(this.skillsFilter || undefined, this.professionFilter || undefined).subscribe({
        next: data => { this.experts.set(data); this.loading.set(false); },
        error: e => { this.error.set(e?.error?.detail ?? 'Failed to load experts'); this.loading.set(false); },
      });
    } else {
      this.marketplace.getJobs(this.skillsFilter || undefined, this.professionFilter || undefined).subscribe({
        next: data => { this.jobs.set(data); this.loading.set(false); },
        error: e => { this.error.set(e?.error?.detail ?? 'Failed to load jobs'); this.loading.set(false); },
      });
    }
  }

  applyFilters(): void { this.loadData(); }

  clearFilters(): void {
    this.skillsFilter = '';
    this.professionFilter = '';
    this.loadData();
  }

  openPostModal(): void {
    this.showPostModal.set(true);
    this.postError.set('');
    this.postSuccess.set(false);
  }

  closePostModal(): void { this.showPostModal.set(false); }

  submitJob(): void {
    this.postLoading.set(true);
    this.postError.set('');
    const payload: JobPostCreate = {
      ...this.newJob,
      required_skills: this.requiredSkillsRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
    this.marketplace.postJob(payload).subscribe({
      next: job => {
        this.postLoading.set(false);
        this.postSuccess.set(true);
        this.jobs.set([job, ...this.jobs()]);
        setTimeout(() => this.closePostModal(), 1500);
      },
      error: e => {
        this.postError.set(e?.error?.detail ?? 'Failed to post job');
        this.postLoading.set(false);
      },
    });
  }

  availabilityLabel(a: string): string {
    const map: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', project_based: 'Project' };
    return map[a] ?? a;
  }

  durationLabel(d: string): string {
    const map: Record<string, string> = { one_time: 'One-time', short_term: 'Short term', long_term: 'Long term', ongoing: 'Ongoing' };
    return map[d] ?? d;
  }

  locationLabel(l: string): string {
    const map: Record<string, string> = { remote: 'Remote', onsite: 'On-site', hybrid: 'Hybrid' };
    return map[l] ?? l;
  }

  budgetLabel(job: JobPost): string {
    const suffix = job.budget_type === 'hourly' ? '/hr' : job.budget_type === 'monthly' ? '/mo' : '';
    return '$' + job.budget_amount.toLocaleString() + suffix;
  }
}
