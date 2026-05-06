export interface Expert {
  id: string;
  name: string;
  role: string;
  bio: string;
  experience: string[];
  tags: string[];
  achievements: string;
  status?: 'active' | 'busy' | 'unavailable';
  sourceSheet?: string;
  sourceSheets?: string[];
  sourceSheetIds?: string[];
  metadata?: Record<string, any>;
  matchDetails?: {
    score: number;
    reason: string;
    gap: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface User {
  email: string;
  role: 'admin' | 'member';
}

export interface MatchAnalysis {
  expertiseNeeded: string;
  industry: string;
  problemStatement: string[];
  stage: string;
  seniority: string;
  essentialSkills: string[];
  keywords: string[];
}

export interface MatchResponse {
  analysis: MatchAnalysis;
  matches: Expert[];
}

export interface InternalChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  content: string;
  timestamp: number;
}
