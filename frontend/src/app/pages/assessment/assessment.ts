import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass, TitleCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CareerService, AssessmentInput, AssessmentOutput, AssessmentRecord, RoleDetailOutput, SkillTrainingOutput, TrainingSession, SavedTrainingSession } from '../../services/career.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-assessment',
  imports: [FormsModule, NgClass, RouterLink, TitleCasePipe, NavbarComponent],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class AssessmentComponent implements OnInit {
  step = signal(1);
  loading = signal(false);
  error = signal('');
  result = signal<AssessmentOutput | null>(null);

  cvFileName = signal('');
  cvUploading = signal(false);
  cvError = signal('');
  cvText = signal('');
  cvSavedToDb = signal(false);
  cvExpanded = signal(false);

  roleDetail = signal<RoleDetailOutput | null>(null);
  roleDetailLoading = signal(false);
  roleDetailError = signal('');

  skillTraining = signal<SkillTrainingOutput | null>(null);
  skillTrainingLoading = signal(false);
  skillTrainingError = signal('');
  progressSaveError = signal('');
  selectedSkill = signal('');
  completedSteps = signal<number[]>([]);
  trainingSessions = signal<TrainingSession[]>([]);

  trainingGenerating = signal(false);
  trainingGeneratingSkill = signal('');

  form: AssessmentInput = {
    job_title: '',
    current_industry: '',
    years_experience: 0,
    current_skills: [],
    education_level: 'bachelor',
    annual_salary: null,
    location: '',
  };

  skillsRaw = '';

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
    this.career.getAssessments().subscribe({
      next: (records: AssessmentRecord[]) => {
        if (records.length > 0) {
          const last = records[0];
          this.form = {
            job_title: last.job_title,
            current_industry: last.current_industry,
            years_experience: last.years_experience,
            current_skills: last.current_skills ?? [],
            education_level: last.education_level,
            annual_salary: last.annual_salary ?? null,
            location: last.location ?? '',
          };
          this.skillsRaw = (last.current_skills ?? []).join(', ');
          this.result.set({
            ai_displacement_risk: last.ai_displacement_risk,
            risk_level: last.risk_level,
            risk_explanation: last.risk_explanation,
            affected_tasks: last.affected_tasks,
            safe_tasks: last.safe_tasks,
            recommended_path: last.recommended_path,
            path_explanation: last.path_explanation,
            recommended_roles: last.recommended_roles,
            skills_to_learn: last.skills_to_learn,
            timeline_months: last.timeline_months,
            salary_potential: last.salary_potential,
          });
          this.step.set(3);
          this.cdr.detectChanges();
        }
      },
      error: () => { /* silently ignore — form stays empty */ },
    });

    this.career.getUserCv().subscribe({
      next: (cv) => {
        if (cv) {
          this.cvText.set(cv.cv_text);
          this.cvFileName.set(cv.cv_filename);
          this.cvSavedToDb.set(true);
        }
      },
      error: () => {},
    });

    this.career.getTrainingSessions().subscribe({
      next: (sessions) => {
        this.trainingSessions.set(sessions);
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  nextStep(): void {
    if (this.step() < 2) this.step.set(this.step() + 1);
  }

  prevStep(): void {
    if (this.step() > 1) this.step.set(this.step() - 1);
  }

  onCvSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.cvError.set('');
    this.cvUploading.set(true);
    this.cvFileName.set(file.name);
    this.career.extractCv(file).subscribe({
      next: (res) => {
        this.cvText.set(res.cv_text);
        this.cvUploading.set(false);
        this.career.saveUserCv(file.name, res.cv_text).subscribe({
          next: () => this.cvSavedToDb.set(true),
          error: () => {},
        });
      },
      error: (e) => {
        this.cvError.set(e?.error?.detail ?? 'Could not read CV. Try a PDF or TXT file.');
        this.cvFileName.set('');
        this.cvUploading.set(false);
      },
    });
  }

  toggleCvView(): void {
    this.cvExpanded.set(!this.cvExpanded());
  }

  removeCv(): void {
    if (this.cvSavedToDb()) {
      this.career.deleteUserCv().subscribe({ error: () => {} });
    }
    this.cvText.set('');
    this.cvFileName.set('');
    this.cvError.set('');
    this.cvSavedToDb.set(false);
    this.cvExpanded.set(false);
  }

  submit(): void {
    this.error.set('');
    this.loading.set(true);
    const payload: AssessmentInput = {
      ...this.form,
      current_skills: this.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
      cv_text: this.cvText() || null,
    };

    this.career.submitAssessment(payload).subscribe({
      next: (res) => {
        this.result.set(res);
        this.step.set(3);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.detail ?? e?.message ?? 'Assessment failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  riskColor(): string {
    const r = this.result();
    if (!r) return '#94A3B8';
    if (r.risk_level === 'low') return '#10B981';
    if (r.risk_level === 'medium') return '#F59E0B';
    if (r.risk_level === 'high') return '#FB923C';
    return '#EF4444';
  }

  riskBadgeClass(): string {
    const r = this.result();
    if (!r) return '';
    if (r.risk_level === 'low') return 'badge-green';
    if (r.risk_level === 'medium') return 'badge-amber';
    if (r.risk_level === 'high') return 'badge-orange';
    return 'badge-red';
  }

  pathIcon(): string {
    const r = this.result();
    if (!r) return 'trending_up';
    if (r.recommended_path === 'pivot') return 'swap_horiz';
    if (r.recommended_path === 'upskill') return 'school';
    if (r.recommended_path === 'specialize') return 'military_tech';
    return 'rocket_launch';
  }

  editAndReassess(): void {
    this.step.set(1);
    this.result.set(null);
    this.error.set('');
    this.roleDetail.set(null);
  }

  resetAssessment(): void {
    this.step.set(1);
    this.result.set(null);
    this.error.set('');
    this.skillsRaw = '';
    this.roleDetail.set(null);
    // CV is profile-level — preserve it across assessments
    this.form = {
      job_title: '',
      current_industry: '',
      years_experience: 0,
      current_skills: [],
      education_level: 'bachelor',
      annual_salary: null,
      location: '',
    };
  }

  onRoleClick(role: string): void {
    this.roleDetail.set(null);
    this.roleDetailError.set('');
    this.roleDetailLoading.set(true);
    this.career.getRoleDetail({
      role,
      job_title: this.form.job_title,
      current_industry: this.form.current_industry,
      years_experience: this.form.years_experience,
      current_skills: this.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
      education_level: this.form.education_level,
      cv_text: this.cvText() || null,
    }).subscribe({
      next: (detail) => {
        this.roleDetail.set(detail);
        this.roleDetailLoading.set(false);
      },
      error: (e) => {
        this.roleDetailError.set(e?.error?.detail ?? 'Could not load role details. Please try again.');
        this.roleDetailLoading.set(false);
      },
    });
  }

  closeRoleDetail(): void {
    this.roleDetail.set(null);
    this.roleDetailError.set('');
    this.roleDetailLoading.set(false);
  }

  onSkillClick(skill: string): void {
    this.skillTraining.set(null);
    this.skillTrainingError.set('');
    this.completedSteps.set([]);
    this.skillTrainingLoading.set(true);
    this.selectedSkill.set(skill);

    // Check if the user has a saved session for this skill first
    this.career.getTrainingSession(skill).subscribe({
      next: (saved: SavedTrainingSession | null) => {
        if (saved) {
          // Resume saved session — no AI call needed
          this.skillTraining.set(saved.training_data);
          this.completedSteps.set(saved.completed_steps ?? []);
          this.skillTrainingLoading.set(false);
        } else {
          // Generate new training plan with AI, then auto-save
          this.career.getSkillTraining({
            skill,
            job_title: this.form.job_title,
            current_industry: this.form.current_industry,
            years_experience: this.form.years_experience,
            current_skills: this.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
            education_level: this.form.education_level,
            cv_text: this.cvText() || null,
          }).subscribe({
            next: (training) => {
              this.skillTraining.set(training);
              this.skillTrainingLoading.set(false);
              // Auto-save the new session
              this.career.saveTrainingSession(skill, training).subscribe({
                next: () => {
                  // Refresh session list
                  this.career.getTrainingSessions().subscribe({
                    next: (sessions) => this.trainingSessions.set(sessions),
                    error: () => {},
                  });
                },
                error: () => {},
              });
            },
            error: (e) => {
              this.skillTrainingError.set(e?.error?.detail ?? 'Could not load training plan. Please try again.');
              this.skillTrainingLoading.set(false);
            },
          });
        }
      },
      error: () => {
        // If session lookup fails, fall back to AI generation
        this.career.getSkillTraining({
          skill,
          job_title: this.form.job_title,
          current_industry: this.form.current_industry,
          years_experience: this.form.years_experience,
          current_skills: this.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
          education_level: this.form.education_level,
          cv_text: this.cvText() || null,
        }).subscribe({
          next: (training) => {
            this.skillTraining.set(training);
            this.skillTrainingLoading.set(false);
          },
          error: (e) => {
            this.skillTrainingError.set(e?.error?.detail ?? 'Could not load training plan. Please try again.');
            this.skillTrainingLoading.set(false);
          },
        });
      },
    });
  }

  toggleStep(stepNum: number): void {
    const current = this.completedSteps();
    const next = current.includes(stepNum)
      ? current.filter(n => n !== stepNum)
      : [...current, stepNum];
    this.completedSteps.set(next);
    this.progressSaveError.set('');
    // Persist progress
    this.career.updateTrainingProgress(this.selectedSkill(), next).subscribe({
      next: () => {
        // Update session list with new completed_steps count
        this.trainingSessions.set(
          this.trainingSessions().map(s =>
            s.skill === this.selectedSkill() ? { ...s, completed_steps: next } : s
          )
        );
      },
      error: () => {
        this.completedSteps.set(current); // revert on failure
        this.progressSaveError.set('Could not save progress. Please check your connection and try again.');
      },
    });
  }

  isStepDone(stepNum: number): boolean {
    return this.completedSteps().includes(stepNum);
  }

  trainingProgress(): number {
    const training = this.skillTraining();
    if (!training?.steps?.length) return 0;
    return Math.round((this.completedSteps().length / training.steps.length) * 100);
  }

  goLearnSkill(skill: string): void {
    this.closeRoleDetail();
    this.trainingGenerating.set(true);
    this.trainingGeneratingSkill.set(skill);
    // If session already exists, navigate directly
    this.career.getTrainingSession(skill).subscribe({
      next: (saved) => {
        if (saved) {
          this.router.navigate(['/trainings']);
          return;
        }
        // Generate + save, then navigate
        this.career.getSkillTraining({
          skill,
          job_title: this.form.job_title,
          current_industry: this.form.current_industry,
          years_experience: this.form.years_experience,
          current_skills: this.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
          education_level: this.form.education_level,
          cv_text: this.cvText() || null,
        }).subscribe({
          next: (training) => {
            this.career.saveTrainingSession(skill, training).subscribe({
              next: () => this.router.navigate(['/trainings']),
              error: () => this.router.navigate(['/trainings']),
            });
          },
          error: () => { this.trainingGenerating.set(false); },
        });
      },
      error: () => { this.trainingGenerating.set(false); },
    });
  }

  closeSkillTraining(): void {
    this.skillTraining.set(null);
    this.skillTrainingError.set('');
    this.skillTrainingLoading.set(false);
    this.progressSaveError.set('');
    this.selectedSkill.set('');
  }

  totalTrainingHours(): number {
    return (this.skillTraining()?.steps ?? []).reduce((sum, s) => sum + (s.estimated_hours ?? 0), 0);
  }

  trainingDifficultyColor(): string {
    const d = this.skillTraining()?.difficulty;
    if (d === 'beginner') return '#10B981';
    if (d === 'intermediate') return '#F59E0B';
    return '#EF4444';
  }

  difficultyColor(): string {
    const d = this.roleDetail()?.difficulty;
    if (d === 'easy') return '#10B981';
    if (d === 'medium') return '#F59E0B';
    return '#EF4444';
  }
}
