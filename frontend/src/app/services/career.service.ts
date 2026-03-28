import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface AssessmentInput {
  job_title: string;
  current_industry: string;
  years_experience: number;
  current_skills: string[];
  education_level: 'high_school' | 'bachelor' | 'master' | 'phd' | 'other';
  annual_salary?: number | null;
  location?: string;
  cv_text?: string | null;
}

export interface AssessmentOutput {
  ai_displacement_risk: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_explanation: string;
  affected_tasks: string[];
  safe_tasks: string[];
  recommended_path: 'pivot' | 'upskill' | 'specialize' | 'entrepreneurship';
  path_explanation: string;
  recommended_roles: string[];
  skills_to_learn: string[];
  timeline_months: number;
  salary_potential?: number | null;
}

export interface AssessmentRecord extends AssessmentInput, AssessmentOutput {
  id: string;
  user_id: string;
  created_at: string;
}

export interface UserCv {
  id: string;
  user_id: string;
  cv_text: string;
  cv_filename: string;
  updated_at: string;
}

export interface RoleDetailInput {
  role: string;
  job_title: string;
  current_industry: string;
  years_experience: number;
  current_skills: string[];
  education_level: string;
  cv_text?: string | null;
}

export interface LearningStep {
  step: number;
  title: string;
  description: string;
  duration_months: number;
  resources: string[];
}

export interface RoleDetailOutput {
  role: string;
  overview: string;
  skills_you_have: string[];
  skills_to_acquire: string[];
  learning_path: LearningStep[];
  timeline_months: number;
  difficulty: 'easy' | 'medium' | 'hard';
  salary_range: string;
}

export interface CvImproveInput {
  cv_text: string;
  target_role?: string;
}

export interface CvImproveOutput {
  improved_cv: string;
  improvements: string[];
}

export interface CvExportInput {
  cv_text: string;
  template: 'classic' | 'modern' | 'minimal';
  format: 'docx' | 'pdf';
}

export interface SkillTrainingInput {
  skill: string;
  job_title: string;
  current_industry: string;
  years_experience: number;
  current_skills: string[];
  education_level: string;
  cv_text?: string | null;
}

export interface TrainingStep {
  step: number;
  title: string;
  description: string;
  tasks: string[];
  estimated_hours: number;
}

export interface AiSkillSuggestion {
  tool: string;
  use_case: string;
  relevance: string;
}

export interface SkillTrainingOutput {
  skill: string;
  project_title: string;
  project_description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  why_this_project: string;
  tech_stack: string[];
  steps: TrainingStep[];
  outcome: string;
  resources: string[];
  ai_skills?: AiSkillSuggestion[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface StepLesson {
  explanation: string;
  key_concepts: string[];
  code_example: string;
  code_language: string;
  tips: string[];
  common_pitfalls: string[];
  quiz: QuizQuestion[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface TrainingSession {
  id: string;
  skill: string;
  completed_steps: number[];
  created_at: string;
  updated_at: string;
}

export interface SavedTrainingSession extends TrainingSession {
  training_data: SkillTrainingOutput;
}

@Injectable({ providedIn: 'root' })
export class CareerService {
  constructor(private api: ApiService) {}

  submitAssessment(data: AssessmentInput): Observable<AssessmentOutput> {
    return this.api.post<AssessmentOutput>('/career/assessment', data);
  }

  extractCv(file: File): Observable<{ cv_text: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.api.postFormData<{ cv_text: string }>('/career/cv-extract', fd);
  }

  getAssessments(): Observable<AssessmentRecord[]> {
    return this.api.get<AssessmentRecord[]>('/career/assessments');
  }

  getUserCv(): Observable<UserCv | null> {
    return this.api.get<UserCv | null>('/career/user-cv');
  }

  saveUserCv(cv_filename: string, cv_text: string): Observable<UserCv> {
    return this.api.put<UserCv>('/career/user-cv', { cv_filename, cv_text });
  }

  deleteUserCv(): Observable<void> {
    return this.api.delete<void>('/career/user-cv');
  }

  getRoleDetail(data: RoleDetailInput): Observable<RoleDetailOutput> {
    return this.api.post<RoleDetailOutput>('/career/role-detail', data);
  }

  improveCV(data: CvImproveInput): Observable<CvImproveOutput> {
    return this.api.post<CvImproveOutput>('/career/cv-improve', data);
  }

  exportCV(data: CvExportInput): Observable<Blob> {
    return this.api.postBlob('/career/cv-export', data);
  }

  getSkillTraining(data: SkillTrainingInput): Observable<SkillTrainingOutput> {
    return this.api.post<SkillTrainingOutput>('/career/skill-training', data);
  }

  saveTrainingSession(skill: string, training_data: SkillTrainingOutput): Observable<SavedTrainingSession> {
    return this.api.put<SavedTrainingSession>('/career/skill-training/session', { skill, training_data });
  }

  getTrainingSession(skill: string): Observable<SavedTrainingSession | null> {
    return this.api.get<SavedTrainingSession | null>(`/career/skill-training/session?skill=${encodeURIComponent(skill)}`);
  }

  getTrainingSessions(): Observable<TrainingSession[]> {
    return this.api.get<TrainingSession[]>('/career/skill-training/sessions');
  }

  updateTrainingProgress(skill: string, completed_steps: number[]): Observable<unknown> {
    return this.api.patch<unknown>('/career/skill-training/session/progress', { skill, completed_steps });
  }

  getStepLesson(skill: string, step: TrainingStep): Observable<StepLesson> {
    return this.api.post<StepLesson>('/career/skill-training/step-lesson', {
      skill,
      step_number: step.step,
      step_title: step.title,
      step_description: step.description,
      step_tasks: step.tasks,
    });
  }

  askStepQuestion(skill: string, stepTitle: string, stepDescription: string, question: string, lessonContext: string): Observable<{ answer: string }> {
    return this.api.post<{ answer: string }>('/career/skill-training/ask', {
      skill,
      step_title: stepTitle,
      step_description: stepDescription,
      question,
      lesson_context: lessonContext,
    });
  }
}
