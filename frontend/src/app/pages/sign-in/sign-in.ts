import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sign-in',
  imports: [FormsModule],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignInComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  private navigateByUserType(): void {
    this.userService.getMe().subscribe({
      next: (user) => {
        this.router.navigate([user.user_type === 'business' ? '/publisher' : '/dashboard']);
      },
      error: async (e) => {
        if (e?.status === 404) {
          // Clerk session exists but no DB record — sign out so the user can re-register
          await this.auth.signOut();
          this.router.navigate(['/sign-up']);
        } else {
          this.error = 'Could not load your profile. Please try again.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
    });
  }

  async ngOnInit(): Promise<void> {
    await this.auth.waitForLoad();
    if (this.auth.isSignedIn()) {
      this.navigateByUserType();
    }
  }

  async onSubmit(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.signIn(this.email, this.password);
      this.navigateByUserType();
    } catch (e: unknown) {
      const err = e as { errors?: { message: string }[]; message?: string };
      this.error = err?.errors?.[0]?.message ?? err?.message ?? 'Incorrect email or password.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
