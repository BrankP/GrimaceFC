export const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
