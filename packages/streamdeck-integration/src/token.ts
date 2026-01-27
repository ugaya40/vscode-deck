export interface TokenManager {
  generate: () => string;
  validate: (token: string) => boolean;
  clear: () => void;
}

export function createTokenManager(): TokenManager {
  let currentToken: string | undefined;

  function generate(): string {
    if (!currentToken) {
      currentToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return currentToken;
  }

  function validate(token: string): boolean {
    return token === currentToken;
  }

  function clear(): void {
    currentToken = undefined;
  }

  return { generate, validate, clear };
}

export function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }
  return authHeader.slice(7);
}
