import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent {

  constructor(private auth: AuthService, private router: Router) {}

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.router.navigate(['/']);
  }
}
