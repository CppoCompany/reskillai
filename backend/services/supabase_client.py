from supabase import create_client, Client
from dotenv import load_dotenv
import os
import logging

logger = logging.getLogger(__name__)

load_dotenv()

# ============================================================
# Supabase Client - חיבור מרכזי לDB
# כל ה-routers ישתמשו בפונקציות האלה
# ============================================================

def get_supabase() -> Client:
    """
    מחזיר חיבור ל-Supabase עם ANON KEY
    מתאים לפעולות שדורשות הרשאות משתמש (RLS)
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY")

    return create_client(url, key)


def get_supabase_admin() -> Client:
    """
    מחזיר חיבור ל-Supabase עם SERVICE KEY
    מתאים לפעולות אדמין שעוקפות RLS
    למשל: יצירת משתמש, מחיקת נתונים
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

    return create_client(url, key)


# ============================================================
# Singleton - חיבור אחד לכל האפליקציה
# במקום ליצור חיבור חדש בכל בקשה
# ============================================================
supabase: Client = get_supabase()
supabase_admin: Client = get_supabase_admin()

logger.info("✅ Supabase clients initialized")