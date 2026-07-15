export type Citation = {
  number: string;
  title: string;
  /** Frase textual del artículo en la que se apoyó la respuesta (para resaltar). */
  quote?: string | null;
};

/** Artículo del CPU con su texto, para mostrarlo inline sin salir del chat. */
export type ArticleContent = { number: string; title: string; content: string };

export type DocumentRef = {
  label: string;
  page?: number;
  source: string;
  /** Fragmento recuperado del documento, para mostrarlo inline sin salir del chat. */
  content?: string | null;
  /** Frase textual del fragmento en la que se apoyó la respuesta (para resaltar). */
  quote?: string | null;
};

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
