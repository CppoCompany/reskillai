import { Injectable, signal } from '@angular/core';
import { Clerk } from '@clerk/clerk-js';
import { environment } from '../../environments/environment';

export interface ClerkUser {
  id: string;
  emailAddresses: { emailAddress: string }[];
  fullName: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clerk: any;
  private readonly loadPromise: Promise<void>;
  readonly user$ = signal<ClerkUser | null>(null);
  readonly isLoaded = signal(false);

  constructor() {
    // Clerk is loaded dynamically at runtime; typed as any to avoid TS constructor issues
    this.clerk = new (Clerk as any)(environment.clerkPublishableKey);
    this.loadPromise = this.clerk.load().then(() => {
      this.user$.set(this.clerk.user as ClerkUser | null);
      this.isLoaded.set(true);

      this.clerk.addListener(({ user }: { user: ClerkUser | null | undefined }) => {
        this.user$.set(user ?? null);
      });
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.loadPromise;
    const result = await this.clerk.client.signIn.create({ identifier: email, password, strategy: 'password' });
    if (result.status === 'complete') {
      await this.clerk.setActive({ session: result.createdSessionId });
    }
  }

  waitForLoad(): Promise<void> {
    return this.loadPromise;
  }

  async signUp(email: string, password: string): Promise<string> {
    await this.loadPromise;
    // Clear any lingering session so Clerk doesn't throw "session_exists"
    if (this.clerk.session) {
      await this.clerk.signOut();
    }
    const result = await this.clerk.client.signUp.create({ emailAddress: email, password });
    // Activate the session immediately if sign-up is complete (no email verification required)
    if (result.status === 'complete' && result.createdSessionId) {
      await this.clerk.setActive({ session: result.createdSessionId });
    }
    return result.createdUserId as string;
  }

  async signOut(): Promise<void> {
    await this.clerk.signOut();
    this.user$.set(null);
  }

  async getToken(): Promise<string | null> {
    await this.loadPromise;
    return this.clerk.session?.getToken() ?? null;
  }

  getCurrentUser(): ClerkUser | null {
    return this.clerk.user as ClerkUser | null;
  }

  isSignedIn(): boolean {
    return !!this.clerk.user;
  }

  openSignIn(): void {
    this.clerk.openSignIn({});
  }

  openSignUp(): void {
    this.clerk.openSignUp({});
  }
}
