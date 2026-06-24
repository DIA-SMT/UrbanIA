export type RagSource = {
  documentId: string;
  title: string;
  chunkId: string;
  excerpt: string;
};

export type RagAnswer = {
  answer: string;
  sources: RagSource[];
};

export async function answerUrbanQuestion(question: string): Promise<RagAnswer> {
  return {
    answer: `Respuesta conceptual pendiente de conectar al vector store para: ${question}`,
    sources: []
  };
}
