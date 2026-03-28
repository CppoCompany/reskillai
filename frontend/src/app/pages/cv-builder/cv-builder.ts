import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CareerService, CvExportInput, CvImproveOutput } from '../../services/career.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-cv-builder',
  imports: [FormsModule, RouterLink, NavbarComponent],
  templateUrl: './cv-builder.html',
  styleUrl: './cv-builder.scss',
})
export class CvBuilderComponent implements OnInit {
  cvText = '';
  targetRole = '';
  loading = signal(false);
  error = signal('');
  result = signal<CvImproveOutput | null>(null);
  copied = signal(false);
  cvSaved = signal(false);
  saving = signal(false);
  selectedTemplate = signal<'classic' | 'modern' | 'minimal'>('modern');
  exporting = signal(false);

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
    this.career.getUserCv().subscribe({
      next: (cv) => {
        if (cv) {
          this.cvText = cv.cv_text;
          this.cdr.detectChanges();
        }
      },
      error: () => {},
    });
  }

  improve(): void {
    if (!this.cvText.trim()) return;
    this.error.set('');
    this.result.set(null);
    this.cvSaved.set(false);
    this.loading.set(true);
    this.career.improveCV({
      cv_text: this.cvText,
      target_role: this.targetRole.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.detail ?? 'CV improvement failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  copyToClipboard(): void {
    const text = this.result()?.improved_cv;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }

  saveAsMyCV(): void {
    const text = this.result()?.improved_cv;
    if (!text) return;
    this.saving.set(true);
    this.career.saveUserCv('improved-cv.txt', text).subscribe({
      next: () => {
        this.cvText = text;
        this.cvSaved.set(true);
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }

  downloadTxt(): void {
    const text = this.result()?.improved_cv;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'improved-cv.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCV(format: 'docx' | 'pdf'): void {
    const text = this.result()?.improved_cv ?? this.cvText;
    if (!text.trim()) return;
    this.exporting.set(true);
    const payload: CvExportInput = {
      cv_text: text,
      template: this.selectedTemplate(),
      format,
    };
    this.career.exportCV(payload).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cv-${this.selectedTemplate()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.error.set('Export failed. Please try again.');
        this.exporting.set(false);
      },
    });
  }
}
