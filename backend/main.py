# =============================================================================
# ReSkillAI — Backend
# Copyright (c) 2026 Barak Shuli & Doron Maman. All rights reserved.
# Unauthorized copying, distribution or modification of this software,
# via any medium, is strictly prohibited without explicit written permission.
#
# Authors  : Barak Shuli, Doron Maman
# Project  : reskilAI_BarakShuli_DoronMaman
# Created  : 2026-03-15
# Fingerprint: 1bbd8b0a98fe52a55a14ebf4bf1d3d2c363733407f8d5c32b55bb5cd408a5d0e
# =============================================================================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from routers import auth, users, career, marketplace, matches, publisher

# טעינת משתני הסביבה מקובץ .env
load_dotenv()

__authors__     = "Barak Shuli, Doron Maman"
__project__     = "reskilAI_BarakShuli_DoronMaman"
__copyright__   = "Copyright (c) 2026 Barak Shuli & Doron Maman. All rights reserved."
__fingerprint__ = "1bbd8b0a98fe52a55a14ebf4bf1d3d2c363733407f8d5c32b55bb5cd408a5d0e"

# יצירת אפליקציית FastAPI
app = FastAPI(
    title="ReSkillAI API",
    description="API for AI-powered career assessment and expert marketplace",
    version="1.0.0"
)

# הגדרת CORS - מאפשר ל-Angular לתקשר עם ה-Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular runs on port 4200
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# בדיקה שהשרת עובד
app.include_router(auth.router,        prefix="/auth",        tags=["Authentication"])
app.include_router(users.router,       prefix="/users",       tags=["Users"])
app.include_router(career.router,      prefix="/career",      tags=["Career Assessment"])
app.include_router(marketplace.router, prefix="/marketplace", tags=["Marketplace"])
app.include_router(matches.router,     prefix="/matches",     tags=["Matches"])
app.include_router(publisher.router,   prefix="/publisher",   tags=["Publisher"])


@app.get("/")
def root():
    return {
        "message": "ReSkillAI API is running!",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "supabase_url": os.getenv("SUPABASE_URL")
    }