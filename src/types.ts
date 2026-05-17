export interface SheetSource {
  id: string;
  url: string;
  lastSynced?: string;
}

export interface Expert {
  id: string;
  name: string;
  role: string;
  industry: string;
  experience: string;
  email?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface MatchRecord {
  id: string;
  expertId: string;
  expertName: string;
  expertRole: string;
  clientName: string;
  clientIndustry: string;
  clientLocation: string;
  clientRequirements: string;
  clientBudget: string;
  clientPreferredRole: string;
  clientContact: string;
  createdAt: string;
}
