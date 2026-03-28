import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { UserService, UserProfile } from '../../services/user.service';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-dashboard',
  imports: [UpperCasePipe, RouterLink, NavbarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  user: UserProfile | null = null;

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.waitForLoad();
    if (!this.auth.isSignedIn()) {
      this.router.navigate(['/sign-in']);
      return;
    }
    this.userService.getMe().subscribe({
      next: user => { this.user = user; },
      error: async (e) => {
        if (e?.status === 404) {
          // Clerk session exists but no backend record — previous sign-up failed.
          // Sign out and redirect to sign-up to start fresh.
          await this.auth.signOut();
          this.router.navigate(['/sign-up']);
        } else {
          this.router.navigate(['/sign-in']);
        }
      }
    });
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.router.navigate(['/']);
  }
}
