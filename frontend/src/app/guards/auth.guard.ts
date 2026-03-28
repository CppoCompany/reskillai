import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoaded()) {
    // Clerk still loading — allow through and let components handle it
    return true;
  }

  if (auth.isSignedIn()) {
    return true;
  }

  return router.createUrlTree(['/sign-in']);
};
