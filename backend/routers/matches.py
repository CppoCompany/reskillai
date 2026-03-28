from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_matches():
    return {"message": "AI Matching — coming in Phase 4"}
