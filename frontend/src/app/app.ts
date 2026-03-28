// Copyright (c) 2026 Barak Shuli & Doron Maman. All rights reserved.
// reskilAI_BarakShuli_DoronMaman | fp:1bbd8b0a98fe52a55a14ebf4bf1d3d2c363733407f8d5c32b55bb5cd408a5d0e
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  title = 'ReSkillAI';
}
