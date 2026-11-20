export function createConversationStream(applyFrame: (frame: { event?: string; data: string; id?: string }) => boolean): {
  cancel: () => void;
  read: (openResponse: (signal: AbortSignal) => Promise<Response>) => Promise<void>;
};
