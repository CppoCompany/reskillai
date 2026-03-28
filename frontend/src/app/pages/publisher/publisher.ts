import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass, TitleCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { UserService, UserProfile } from '../../services/user.service';
import { PublisherService, Position, PositionDraft, PositionMatch, BusinessProfile, PublisherProfile } from '../../services/publisher.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-publisher',
  imports: [FormsModule, NgClass, RouterLink, TitleCasePipe, NavbarComponent],
  templateUrl: './publisher.html',
  styleUrl: './publisher.scss',
})
export class PublisherComponent implements OnInit {
  user = signal<UserProfile | null>(null);
  pageLoading = signal(true);
  accessError = signal('');

  positions = signal<Position[]>([]);
  activePosition = signal<Position | null>(null);
  matches = signal<PositionMatch[]>([]);
  matchesLoading = signal(false);

  rematchLoading = signal(false);

  // Form state
  showForm = signal(false);
  formStep = signal<1 | 2>(1); // 1=fill, 2=posting spinner
  postLoading = signal(false);
  formError = signal('');
  editingId = signal<string | null>(null);

  draft: PositionDraft = this.emptyDraft();
  skillsRaw = '';

  // Profile modal
  showProfile = signal(false);
  profileLoading = signal(false);
  profileSaving = signal(false);
  profileError = signal('');
  profile = signal<PublisherProfile | null>(null);
  profileDraft: Partial<BusinessProfile> = {};
  profileNeedsRaw = '';

  // Match comment editing
  editingCommentId = signal<string | null>(null);
  commentDraft = '';

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private publisher: PublisherService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.waitForLoad();
    if (!this.auth.isSignedIn()) {
      this.router.navigate(['/sign-in']);
      return;
    }
    this.userService.getMe().subscribe({
      next: (user) => {
        this.user.set(user);
        if (user.user_type !== 'business') {
          this.accessError.set('This area is for employer accounts only. Sign up as a Business to post positions.');
          this.pageLoading.set(false);
          return;
        }
        this.loadPositions();
      },
      error: async (e) => {
        if (e?.status === 404) {
          await this.auth.signOut();
          this.router.navigate(['/sign-up']);
        } else {
          this.router.navigate(['/sign-in']);
        }
      },
    });
  }

  loadPositions(): void {
    this.publisher.getPositions().subscribe({
      next: (positions) => {
        this.positions.set(positions);
        this.pageLoading.set(false);
        if (positions.length > 0) {
          this.selectPosition(positions[0]);
        }
      },
      error: () => this.pageLoading.set(false),
    });
  }

  selectPosition(pos: Position): void {
    this.activePosition.set(pos);
    this.matches.set([]);
    this.matchesLoading.set(true);
    this.publisher.getMatches(pos.id).subscribe({
      next: (m) => { this.matches.set(m); this.matchesLoading.set(false); },
      error: () => this.matchesLoading.set(false),
    });
  }

  openForm(): void {
    this.draft = this.emptyDraft();
    this.skillsRaw = '';
    this.formError.set('');
    this.formStep.set(1);
    this.editingId.set(null);
    this.showForm.set(true);
  }

  openEditForm(pos: Position): void {
    this.draft = {
      title: pos.title,
      description: pos.description,
      required_skills: pos.required_skills,
      required_experience: pos.required_experience,
      education_level: pos.education_level,
      location: pos.location ?? '',
      work_type: pos.work_type,
      employment_type: pos.employment_type,
      salary_min: pos.salary_min ?? null,
      salary_max: pos.salary_max ?? null,
    };
    this.skillsRaw = pos.required_skills.join(', ');
    this.formError.set('');
    this.formStep.set(1);
    this.editingId.set(pos.id);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  submitPosition(): void {
    this.formError.set('');
    this.postLoading.set(true);
    this.formStep.set(2);
    const payload = this.buildDraft();
    const id = this.editingId();
    const request$ = id
      ? this.publisher.updatePosition(id, payload)
      : this.publisher.createPosition(payload);

    request$.subscribe({
      next: (result) => {
        const { matches, ...pos } = result as any;
        const updatedPos: Position = { ...pos, match_count: matches?.length ?? 0 };
        if (id) {
          this.positions.set(this.positions().map(p => p.id === id ? updatedPos : p));
        } else {
          this.positions.set([updatedPos, ...this.positions()]);
        }
        this.activePosition.set(updatedPos);
        this.matches.set(matches ?? []);
        this.postLoading.set(false);
        this.showForm.set(false);
      },
      error: (e) => {
        this.formError.set(e?.error?.detail ?? 'Failed to save position. Please try again.');
        this.postLoading.set(false);
        this.formStep.set(1);
      },
    });
  }

  runRematch(): void {
    const pos = this.activePosition();
    if (!pos || this.rematchLoading()) return;
    this.rematchLoading.set(true);
    this.matches.set([]);
    this.publisher.rematch(pos.id).subscribe({
      next: (res) => {
        this.matches.set(res.matches);
        const newCount = res.matches.length;
        this.positions.set(this.positions().map(p => p.id === pos.id ? { ...p, match_count: newCount } : p));
        this.activePosition.set({ ...pos, match_count: newCount });
        this.rematchLoading.set(false);
      },
      error: () => this.rematchLoading.set(false),
    });
  }

  toggleStatus(pos: Position): void {
    const next = pos.status === 'open' ? 'closed' : 'open';
    this.publisher.updateStatus(pos.id, next).subscribe({
      next: (updated) => {
        this.positions.set(this.positions().map(p => p.id === pos.id ? { ...p, status: next } : p));
        if (this.activePosition()?.id === pos.id) {
          this.activePosition.set({ ...this.activePosition()!, status: next });
        }
      },
      error: () => {},
    });
  }

  matchScoreClass(score: number): string {
    if (score >= 80) return 'score--high';
    if (score >= 60) return 'score--medium';
    return 'score--low';
  }

  riskBadgeClass(risk: string): string {
    if (risk === 'low') return 'badge-green';
    if (risk === 'medium') return 'badge-amber';
    if (risk === 'high') return 'badge-orange';
    return 'badge-red';
  }

  eduLabel(e: string): string {
    const map: Record<string, string> = { high_school: 'High School', bachelor: 'Bachelor', master: 'Master', phd: 'PhD', other: 'Other' };
    return map[e] ?? e;
  }

  salaryDisplay(pos: Position): string {
    if (!pos.salary_min && !pos.salary_max) return 'Not specified';
    if (pos.salary_min && pos.salary_max) return `$${pos.salary_min.toLocaleString()} – $${pos.salary_max.toLocaleString()}`;
    return pos.salary_min ? `From $${pos.salary_min.toLocaleString()}` : `Up to $${pos.salary_max!.toLocaleString()}`;
  }

  // ── Profile ──────────────────────────────────────────────────
  openProfile(): void {
    this.showProfile.set(true);
    this.profileError.set('');
    if (this.profile()) return; // already loaded
    this.profileLoading.set(true);
    this.publisher.getProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        if (p.business) {
          this.profileDraft = { ...p.business };
          this.profileNeedsRaw = (p.business.needs ?? []).join(', ');
        }
        this.profileLoading.set(false);
      },
      error: () => { this.profileError.set('Could not load profile.'); this.profileLoading.set(false); },
    });
  }

  closeProfile(): void { this.showProfile.set(false); }

  saveProfile(): void {
    this.profileSaving.set(true);
    this.profileError.set('');
    const payload = {
      ...this.profileDraft,
      needs: this.profileNeedsRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
    this.publisher.updateBusinessProfile(payload).subscribe({
      next: (biz) => {
        this.profile.set({ ...this.profile()!, business: biz });
        this.profileSaving.set(false);
        this.showProfile.set(false);
      },
      error: (e) => {
        this.profileError.set(e?.error?.detail ?? 'Failed to save profile.');
        this.profileSaving.set(false);
      },
    });
  }

  // ── Match feedback ────────────────────────────────────────────
  setRelevance(match: PositionMatch, value: boolean): void {
    const posId = this.activePosition()!.id;
    const newVal = match.is_relevant === value ? null : value; // toggle off if same
    this.publisher.updateMatchFeedback(posId, match.id, { is_relevant: newVal }).subscribe({
      next: () => {
        this.matches.set(this.matches().map(m => m.id === match.id ? { ...m, is_relevant: newVal } : m));
      },
      error: () => {},
    });
  }

  openComment(match: PositionMatch): void {
    this.editingCommentId.set(match.id);
    this.commentDraft = match.comment ?? '';
  }

  saveComment(match: PositionMatch): void {
    const posId = this.activePosition()!.id;
    this.publisher.updateMatchFeedback(posId, match.id, { comment: this.commentDraft }).subscribe({
      next: () => {
        this.matches.set(this.matches().map(m => m.id === match.id ? { ...m, comment: this.commentDraft } : m));
        this.editingCommentId.set(null);
      },
      error: () => {},
    });
  }

  cancelComment(): void { this.editingCommentId.set(null); }

  private buildDraft(): PositionDraft {
    return {
      ...this.draft,
      required_skills: this.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
  }

  private emptyDraft(): PositionDraft {
    return {
      title: '',
      description: '',
      required_skills: [],
      required_experience: 1,
      education_level: 'bachelor',
      location: '',
      work_type: 'remote',
      employment_type: 'full_time',
      salary_min: null,
      salary_max: null,
    };
  }
}
