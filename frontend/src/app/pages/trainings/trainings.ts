import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgClass, TitleCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CareerService, TrainingSession, SavedTrainingSession, TrainingStep } from '../../services/career.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-trainings',
  imports: [RouterLink, NgClass, TitleCasePipe, NavbarComponent],
  templateUrl: './trainings.html',
  styleUrl: './trainings.scss',
})
export class TrainingsComponent implements OnInit {
  sessions = signal<TrainingSession[]>([]);
  pageLoading = signal(true);
  activeSession = signal<SavedTrainingSession | null>(null);
  activeLoading = signal(false);
  completedSteps = signal<number[]>([]);
  selectedSkill = signal('');
  saveError = signal('');

  constructor(
    private auth: AuthService,
    private career: CareerService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.waitForLoad();
    if (!this.auth.isSignedIn()) {
      this.router.navigate(['/sign-in']);
      return;
    }
    this.career.getTrainingSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.pageLoading.set(false);
        if (sessions.length > 0) {
          this.selectSession(sessions[0].skill);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.pageLoading.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  selectSession(skill: string): void {
    if (this.selectedSkill() === skill && this.activeSession()) return;
    this.selectedSkill.set(skill);
    this.activeSession.set(null);
    this.completedSteps.set([]);
    this.saveError.set('');
    this.activeLoading.set(true);
    this.career.getTrainingSession(skill).subscribe({
      next: (session) => {
        this.activeSession.set(session);
        this.completedSteps.set(session?.completed_steps ?? []);
        this.activeLoading.set(false);
      },
      error: () => { this.activeLoading.set(false); },
    });
  }

  toggleStep(stepNum: number): void {
    const current = this.completedSteps();
    const next = current.includes(stepNum)
      ? current.filter(n => n !== stepNum)
      : [...current, stepNum];
    this.completedSteps.set(next);
    this.saveError.set('');
    this.career.updateTrainingProgress(this.selectedSkill(), next).subscribe({
      next: () => {
        this.sessions.set(
          this.sessions().map(s =>
            s.skill === this.selectedSkill() ? { ...s, completed_steps: next } : s
          )
        );
      },
      error: () => {
        this.completedSteps.set(current);
        this.saveError.set('Could not save progress. Please check your connection and try again.');
      },
    });
  }

  goToLesson(step: TrainingStep): void {
    this.router.navigate(['/lesson'], {
      queryParams: { skill: this.selectedSkill(), step: step.step },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  isStepDone(stepNum: number): boolean {
    return this.completedSteps().includes(stepNum);
  }

  sessionProgress(session: TrainingSession): number {
    if (!session.completed_steps?.length) return 0;
    return Math.round((session.completed_steps.length / 5) * 100);
  }

  activeProgress(): number {
    const s = this.activeSession();
    if (!s?.training_data?.steps?.length) return 0;
    return Math.round((this.completedSteps().length / s.training_data.steps.length) * 100);
  }

  totalHours(): number {
    return (this.activeSession()?.training_data?.steps ?? [])
      .reduce((sum, s) => sum + (s.estimated_hours ?? 0), 0);
  }

  difficultyColor(): string {
    const d = this.activeSession()?.training_data?.difficulty;
    if (d === 'beginner') return '#10B981';
    if (d === 'intermediate') return '#F59E0B';
    return '#EF4444';
  }

  isComplete(session: TrainingSession): boolean {
    return session.completed_steps?.length === 5;
  }
}
