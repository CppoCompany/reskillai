import os
import json
import anthropic
from models.career import AssessmentInput, RoleDetailInput, CvImproveInput, SkillTrainingInput


def run_career_assessment(data: AssessmentInput) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    cv_section = ""
    if data.cv_text:
        cv_section = f"\n\nCV / Resume Content (use this for a more accurate assessment):\n{data.cv_text[:3000]}"

    prompt = f"""You are a career analyst specializing in AI displacement risk assessment.
Analyze this professional's AI displacement risk and provide career guidance.

Professional Profile:
- Job Title: {data.job_title}
- Industry: {data.current_industry}
- Years Experience: {data.years_experience}
- Skills: {', '.join(data.current_skills)}
- Education: {data.education_level}
- Location: {data.location or 'Not specified'}
- Current Salary: {'$' + str(data.annual_salary) if data.annual_salary else 'Not specified'}{cv_section}

Return ONLY valid JSON with no markdown, no explanation, matching this schema exactly:
{{
  "ai_displacement_risk": <integer 0-100>,
  "risk_level": "<low|medium|high|critical>",
  "risk_explanation": "<2-3 sentence explanation of the risk assessment>",
  "affected_tasks": ["<task1>", "<task2>", "<task3>"],
  "safe_tasks": ["<task1>", "<task2>", "<task3>"],
  "recommended_path": "<pivot|upskill|specialize|entrepreneurship>",
  "path_explanation": "<2-3 sentence explanation of recommended path>",
  "recommended_roles": ["<role1>", "<role2>", "<role3>"],
  "skills_to_learn": ["<skill1>", "<skill2>", "<skill3>", "<skill4>", "<skill5>"],
  "timeline_months": <integer 6-36>,
  "salary_potential": <annual USD integer or null>
}}"""

    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def run_role_detail(data: RoleDetailInput) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    cv_section = ""
    if data.cv_text:
        cv_section = f"\n\nCV Content (use for personalisation):\n{data.cv_text[:2000]}"

    skills_str = ", ".join(data.current_skills) if data.current_skills else "Not specified"

    prompt = f"""You are an expert career coach. A professional wants to transition into the role of "{data.role}".

Current Profile:
- Current Role: {data.job_title}
- Industry: {data.current_industry}
- Experience: {data.years_experience} years
- Current Skills: {skills_str}
- Education: {data.education_level}{cv_section}

Provide a personalised, actionable transition plan specifically for this person.
Include exactly 4 learning path steps — no more, no fewer. Keep each description under 60 words. Keep each resources list to 2 items maximum.
Return ONLY valid JSON with no markdown, no explanation, matching this schema exactly:
{{
  "role": "{data.role}",
  "overview": "<2-sentence description of this role and why it suits this person>",
  "skills_you_have": ["<existing skill relevant to the target role>"],
  "skills_to_acquire": ["<specific skill they need to learn>"],
  "learning_path": [
    {{
      "step": 1,
      "title": "<step title>",
      "description": "<what to do and why — be specific>",
      "duration_months": <integer>,
      "resources": ["<specific course, certification or book name>"]
    }}
  ],
  "timeline_months": <total integer>,
  "difficulty": "<easy|medium|hard>",
  "salary_range": "<e.g. $70,000 – $110,000>"
}}"""

    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def run_skill_training(data: SkillTrainingInput) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Determine appropriate difficulty level from experience and skills
    if data.years_experience <= 2:
        level = "beginner"
    elif data.years_experience <= 7:
        level = "intermediate"
    else:
        level = "advanced"

    skills_str = ", ".join(data.current_skills) if data.current_skills else "Not specified"

    cv_section = ""
    if data.cv_text:
        cv_section = f"\n\nCV / Background (use for personalisation):\n{data.cv_text[:1500]}"

    prompt = f"""You are an expert coding coach and curriculum designer. A professional wants to learn "{data.skill}" through a hands-on project.

Their Profile:
- Current Role: {data.job_title}
- Industry: {data.current_industry}
- Experience: {data.years_experience} years
- Existing Skills: {skills_str}
- Education: {data.education_level}
- Appropriate Level: {level}{cv_section}

Design ONE perfect hands-on project to teach them "{data.skill}". The project must:
- Be at {level} level — realistic for their background
- Be directly relevant to their industry ({data.current_industry}) where possible
- Build something tangible they can show in a portfolio
- Have exactly 5 implementation steps
- Each step must have 3-4 specific, actionable tasks
- Keep each step description under 50 words

Return ONLY valid JSON with no markdown, matching this schema exactly:
{{
  "skill": "{data.skill}",
  "project_title": "<catchy project name>",
  "project_description": "<2-sentence description of what they will build>",
  "difficulty": "{level}",
  "why_this_project": "<1-2 sentences: why this project is ideal for this specific person given their background>",
  "tech_stack": ["<tool or library 1>", "<tool or library 2>", "<tool or library 3>"],
  "steps": [
    {{
      "step": 1,
      "title": "<step title>",
      "description": "<what to do and why>",
      "tasks": ["<specific task>", "<specific task>", "<specific task>"],
      "estimated_hours": <integer 1-8>
    }}
  ],
  "outcome": "<1 sentence: what they will have built and learned by the end>",
  "resources": ["<specific book, course or website>", "<specific book, course or website>", "<specific book, course or website>"],
  "ai_skills": [
    {{
      "tool": "<AI tool or model name, e.g. GitHub Copilot, ChatGPT, Claude, Midjourney>",
      "use_case": "<1 sentence: how this tool is used in their industry or for this skill>",
      "relevance": "<why a {data.current_industry} professional needs this AI skill now>"
    }}
  ]
}}

For ai_skills: include 3-4 AI tools that are genuinely useful for someone in {data.current_industry} learning "{data.skill}".
Pick specific, real AI tools — not generic descriptions. Examples: GitHub Copilot, Claude, ChatGPT, Gemini, Midjourney, DALL-E, Cursor, Tabnine, Perplexity, Runway, ElevenLabs, Salesforce Einstein, Microsoft Copilot, Harvey AI, Kira Systems — pick whichever fit best."""

    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def review_position(draft: dict) -> dict:
    """AI review of a job position draft before publishing.
    Returns issues, suggestions, and an overall approval flag."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    skills_str = ", ".join(draft.get("required_skills", [])) or "Not specified"

    prompt = f"""You are a recruitment quality reviewer and HR compliance specialist.
Review this job position draft and identify any problems before it is published.

Position Details:
- Title: {draft.get('title', '')}
- Description: {draft.get('description', '')}
- Required Skills: {skills_str}
- Required Experience: {draft.get('required_experience', 0)} years
- Education Level: {draft.get('education_level', 'not specified')}
- Work Type: {draft.get('work_type', 'not specified')}
- Employment Type: {draft.get('employment_type', 'not specified')}
- Location: {draft.get('location', 'not specified')}
- Salary Range: {draft.get('salary_min', 'not specified')} - {draft.get('salary_max', 'not specified')} USD

Check for:
1. Inappropriate, offensive, or discriminatory language
2. Inconsistencies (e.g. junior title but 10+ years required)
3. Unrealistic salary vs experience/role combination
4. Vague or overly generic descriptions that won't attract quality candidates
5. Missing important information (e.g. no salary, no skills specified)

Return ONLY valid JSON with no markdown, matching this schema exactly:
{{
  "approved": <true if no serious issues, false if action required>,
  "issues": ["<specific problem found>"],
  "suggestions": ["<specific actionable improvement>"]
}}

If nothing is wrong, return approved=true with empty arrays."""

    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def match_experts(position: dict, candidates: list) -> list:
    """Score and rank a list of expert candidates against a position in a single AI call.
    Returns list of { expert_user_id, match_score, explanation, matched_skills }."""
    if not candidates:
        return []

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    skills_str = ", ".join(position.get("required_skills", [])) or "Not specified"

    # Use 1-based index only — AI returns the index, we map back to user_id
    candidate_lines = []
    for i, c in enumerate(candidates):
        cand_skills = ", ".join(c.get("current_skills", [])) or "none"
        cv_snippet = f", CV=[{c['cv_text'][:500]}]" if c.get("cv_text") else ""
        candidate_lines.append(
            f"Candidate #{i+1}: "
            f"Role={c.get('job_title','?')}, Industry={c.get('current_industry','?')}, "
            f"Exp={c.get('years_experience',0)}yrs, Skills=[{cand_skills}], "
            f"Education={c.get('education_level','?')}{cv_snippet}"
        )
    candidates_block = "\n".join(candidate_lines)

    prompt = f"""You are an expert technical recruiter. Score each candidate against the job position below.

Position:
- Title: {position.get('title', '')}
- Required Skills: {skills_str}
- Required Experience: {position.get('required_experience', 0)} years
- Description: {position.get('description', '')[:400]}
- Work Type: {position.get('work_type', '')}
- Employment Type: {position.get('employment_type', '')}

Candidates:
{candidates_block}

For each candidate return:
- candidate_index: the integer number from "Candidate #N" (e.g. 1, 2, 3)
- match_score: integer 0-100 (how well they fit the position)
- explanation: 1 sentence explaining the score
- matched_skills: skills from the candidate that directly match the position requirements

Return ONLY valid JSON array with no markdown:
[
  {{
    "candidate_index": <integer>,
    "match_score": <integer 0-100>,
    "explanation": "<1 sentence>",
    "matched_skills": ["<skill>"]
  }}
]"""

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    raw = json.loads(text)

    # Map candidate_index back to actual user_id
    result = []
    for item in raw:
        idx = item.get("candidate_index")
        if idx is None or not (1 <= idx <= len(candidates)):
            continue
        user_id = candidates[idx - 1]["user_id"]
        result.append({
            "expert_user_id": user_id,
            "match_score": item.get("match_score", 0),
            "explanation": item.get("explanation", ""),
            "matched_skills": item.get("matched_skills", []),
        })
    return result


def generate_step_lesson(step: dict, skill: str) -> dict:
    """Generate a comprehensive interactive lesson + quiz for one training step."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    tasks_str = "\n".join(f"- {t}" for t in step.get("tasks", []))

    prompt = f"""You are an expert coding instructor. Generate a comprehensive, practical lesson for this training step.

Skill: {skill}
Step: {step.get('title', '')}
Description: {step.get('description', '')}
Tasks:
{tasks_str}

Return ONLY valid JSON with no markdown:
{{
  "explanation": "<4-5 paragraphs covering: (1) what this concept is and why it matters, (2) how it works in practice with concrete details, (3) when and how to apply it in real projects, (4) how it connects to the broader skill/ecosystem, (5) summary of what the learner can now do. Be thorough and specific.>",
  "key_concepts": ["<core concept 1>", "<core concept 2>", "<core concept 3>"],
  "code_example": "<a complete, realistic, well-commented code snippet — 20-35 lines with real variable names and practical logic. Empty string only if the skill is entirely non-technical.>",
  "code_language": "<programming language, e.g. typescript, python, javascript — or empty string>",
  "tips": [
    "<pro tip 1 a senior developer would share>",
    "<pro tip 2>",
    "<pro tip 3>"
  ],
  "common_pitfalls": [
    "<common beginner mistake and how to avoid it>",
    "<another pitfall with correction>"
  ],
  "quiz": [
    {{
      "question": "<conceptual question testing deep understanding>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": <0-3>,
      "explanation": "<one sentence: why the correct answer is right>"
    }},
    {{
      "question": "<applied/practical scenario question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": <0-3>,
      "explanation": "<one sentence explanation>"
    }},
    {{
      "question": "<debugging or best-practice question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": <0-3>,
      "explanation": "<one sentence explanation>"
    }}
  ]
}}

Rules:
- Exactly 3 quiz questions, each with exactly 4 options
- correct_index is 0-based (0=A, 1=B, 2=C, 3=D)
- Code example must be complete, well-commented, and runnable"""

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def answer_step_question(skill: str, step_title: str, step_description: str, question: str, lesson_context: str) -> str:
    """Answer a student's question about a training step using lesson context."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""You are a helpful coding instructor teaching "{skill}".

Current lesson — Step: {step_title}
Description: {step_description}
Lesson context: {lesson_context[:1500]}

Student's question: {question}

Answer clearly and practically. Include a short code snippet if it helps illustrate the answer. Keep it under 250 words. Use plain text only."""

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def run_cv_improve(data: CvImproveInput) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    target_section = f"\nTarget Role: {data.target_role}" if data.target_role else ""

    prompt = f"""You are an expert CV/resume writer and career coach. Rewrite the following CV to make it significantly more professional, impactful, and ATS-friendly.{target_section}

Original CV:
---
{data.cv_text[:4000]}
---

Rewriting guidelines:
- Use strong, quantified action verbs (Led, Increased, Delivered, Reduced, etc.)
- Quantify achievements where plausible based on context
- Improve clarity — cut filler words and passive voice
- Use clear sections: PROFESSIONAL SUMMARY, EXPERIENCE, SKILLS, EDUCATION
- Make it ATS-friendly (no tables, clean structure)
- Maintain all factual information — do not invent jobs or qualifications
- If a target role is given, tailor language and emphasis towards it

Return ONLY valid JSON with no markdown, matching this schema exactly:
{{
  "improved_cv": "<the full rewritten CV as plain text, using \\n for line breaks>",
  "improvements": [
    "<specific change made — e.g. Added quantified metrics to 3 achievements>",
    "<specific change made>",
    "<specific change made>",
    "<specific change made>",
    "<specific change made>"
  ]
}}"""

    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)
