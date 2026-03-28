// =============================================================================
// ReSkillAI — Frontend
// Copyright (c) 2026 Barak Shuli & Doron Maman. All rights reserved.
// Unauthorized copying, distribution or modification of this software,
// via any medium, is strictly prohibited without explicit written permission.
//
// Authors  : Barak Shuli, Doron Maman
// Project  : reskilAI_BarakShuli_DoronMaman
// Created  : 2026-03-15
// Fingerprint: 1bbd8b0a98fe52a55a14ebf4bf1d3d2c363733407f8d5c32b55bb5cd408a5d0e
// =============================================================================
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
