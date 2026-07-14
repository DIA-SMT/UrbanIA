export type Citation = { number: string; title: string };

export type DocumentRef = { label: string; page?: number; source: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  retrieved?: Citation[];
  documents?: DocumentRef[];
  isError?: boolean;
};

export type ConversationSummary = {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};
