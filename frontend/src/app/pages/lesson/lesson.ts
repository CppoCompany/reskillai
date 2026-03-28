import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CareerService, StepLesson, TrainingStep, ChatMessage } from '../../services/career.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-lesson',
  standalone: true,
  imports: [RouterLink, NgClass, NavbarComponent, FormsModule],
  templateUrl: './lesson.html',
  styleUrl: './lesson.scss',
})
export class LessonComponent implements OnInit {
  skill = signal('');
  stepNum = signal(0);
  step = signal<TrainingStep | null>(null);

  loading = signal(true);
  lesson = signal<StepLesson | null>(null);
  lessonError = signal('');

  quizAnswers = signal<Record<number, number>>({});
  quizSubmitted = signal(false);

  chatMessages = signal<ChatMessage[]>([]);
  chatInputValue = '';
  chatLoading = signal(false);

  constructor(
    private route: ActivatedRoute,
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

    const params = this.route.snapshot.queryParamMap;
    const skill = params.get('skill') || '';
    const stepNum = Number(params.get('step') || 0);

    if (!skill || !stepNum) {
      this.router.navigate(['/trainings']);
      return;
    }

    this.skill.set(skill);
    this.stepNum.set(stepNum);

    this.career.getTrainingSession(skill).subscribe({
      next: (session) => {
        const step = session?.training_data?.steps?.find(s => s.step === stepNum);
        if (!step) {
          this.router.navigate(['/trainings']);
          return;
        }
        this.step.set(step);
        this.career.getStepLesson(skill, step).subscribe({
          next: (l) => {
            this.lesson.set(l);
            this.loading.set(false);
            this.cdr.detectChanges();
          },
          error: () => {
            this.lessonError.set('Could not load lesson. Please try again.');
            this.loading.set(false);
            this.cdr.detectChanges();
          },
        });
      },
      error: () => this.router.navigate(['/trainings']),
    });
  }

  sendQuestion(): void {
    const q = this.chatInputValue.trim();
    const l = this.lesson();
    const s = this.step();
    if (!q || !l || !s || this.chatLoading()) return;

    this.chatMessages.set([...this.chatMessages(), { role: 'user', text: q }]);
    this.chatInputValue = '';
    this.chatLoading.set(true);

    this.career.askStepQuestion(
      this.skill(), s.title, s.description, q, l.explanation
    ).subscribe({
      next: (res) => {
        this.chatMessages.set([...this.chatMessages(), { role: 'assistant', text: res.answer }]);
        this.chatLoading.set(false);
      },
      error: () => {
        this.chatMessages.set([...this.chatMessages(), { role: 'assistant', text: 'Sorry, I could not answer that right now. Please try again.' }]);
        this.chatLoading.set(false);
      },
    });
  }

  openInStackBlitz(code: string, language: string, stepTitle: string): void {
    const ext = this.codeExt(language);
    const template = this.sbTemplate(language);
    const form = document.createElement('form');
    form.method = 'post';
    form.action = 'https://stackblitz.com/run';
    form.target = '_blank';
    form.style.display = 'none';

    const fields: Record<string, string> = {
      'project[title]': stepTitle,
      'project[description]': `Practice from ReSkillAI — ${this.skill()}`,
      'project[template]': template,
      [`project[files][index.${ext}]`]: code,
    };

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).catch(() => {});
  }

  selectAnswer(qIdx: number, optIdx: number): void {
    if (this.quizSubmitted()) return;
    this.quizAnswers.set({ ...this.quizAnswers(), [qIdx]: optIdx });
  }

  submitQuiz(): void {
    this.quizSubmitted.set(true);
  }

  allAnswered(): boolean {
    const l = this.lesson();
    if (!l) return false;
    return l.quiz.every((_, i) => this.quizAnswers()[i] !== undefined);
  }

  quizScore(): number {
    const l = this.lesson();
    if (!l) return 0;
    return l.quiz.filter((q, i) => this.quizAnswers()[i] === q.correct_index).length;
  }

  answerClass(qIdx: number, optIdx: number): string {
    if (!this.quizSubmitted()) {
      return this.quizAnswers()[qIdx] === optIdx ? 'quiz-option--selected' : '';
    }
    const q = this.lesson()?.quiz[qIdx];
    if (!q) return '';
    if (optIdx === q.correct_index) return 'quiz-option--correct';
    if (this.quizAnswers()[qIdx] === optIdx) return 'quiz-option--wrong';
    return '';
  }

  isDevLanguage(lang: string): boolean {
    const devLangs = new Set([
      'typescript', 'javascript', 'python', 'java', 'go', 'rust',
      'php', 'ruby', 'css', 'html', 'jsx', 'tsx', 'ts', 'js',
      'py', 'c', 'cpp', 'c++', 'csharp', 'c#', 'swift', 'kotlin',
      'scala', 'bash', 'shell', 'sql', 'r', 'dart', 'node', 'nodejs',
    ]);
    return devLangs.has(lang?.toLowerCase());
  }

  private codeExt(lang: string): string {
    const map: Record<string, string> = {
      typescript: 'ts', javascript: 'js', python: 'py',
      java: 'java', css: 'css', html: 'html', jsx: 'jsx', tsx: 'tsx',
      go: 'go', rust: 'rs', php: 'php', ruby: 'rb',
    };
    return map[lang?.toLowerCase()] ?? 'js';
  }

  private sbTemplate(lang: string): string {
    const l = lang?.toLowerCase();
    if (l === 'angular') return 'angular-cli';
    if (l === 'react' || l === 'jsx' || l === 'tsx') return 'create-react-app';
    if (l === 'node' || l === 'nodejs') return 'node';
    if (l === 'typescript' || l === 'ts') return 'typescript';
    return 'javascript';
  }
}
