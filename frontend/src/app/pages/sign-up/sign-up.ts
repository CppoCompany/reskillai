import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sign-up',
  imports: [FormsModule],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUpComponent implements OnInit {
  fullName = '';
  email = '';
  password = '';
  userType: 'expert' | 'business' | null = null;
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.waitForLoad();
    if (this.auth.isSignedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    // Pre-select user type from query param (e.g. /sign-up?role=business)
    const role = this.route.snapshot.queryParamMap.get('role');
    if (role === 'business' || role === 'expert') {
      this.userType = role;
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.userType) return;
    this.loading = true;
    this.error = '';
    try {
      const clerkUserId = await this.auth.signUp(this.email, this.password);
      if (!clerkUserId) throw new Error('Sign up succeeded but no user ID returned. Check Clerk dashboard — email verification may be required.');

      this.userService.register({
        clerk_id: clerkUserId,
        email: this.email,
        full_name: this.fullName,
        user_type: this.userType,
      }).subscribe({
        next: () => this.router.navigate(['/onboarding'], { state: { userType: this.userType } }),
        error: (e) => {
          if (e?.status === 0) {
            this.error = 'Cannot reach the server. Is the backend running on port 8000?';
          } else {
            this.error = e?.error?.detail ?? e?.error?.message ?? e?.message ?? 'Registration failed';
          }
          this.loading = false;
        }
      });
    } catch (e: unknown) {
      // Clerk errors: { errors: [{ message, longMessage, code }] }
      const err = e as { errors?: { message: string; longMessage?: string }[]; message?: string };
      const clerkMsg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message;
      this.error = clerkMsg ?? err?.message ?? 'Sign up failed. Please try again.';
      this.loading = false;
    }
  }
}
