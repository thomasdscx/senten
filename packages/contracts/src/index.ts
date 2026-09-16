export interface Contract<T> {
  readonly name: string;
  parse(input: unknown): T;
}

export function defineContract<T>(name: string, parser: (input: unknown) => T): Contract<T> {
  return { name, parse: parser };
}

export class ContractError extends Error {
  constructor(public readonly contract: string, message: string) {
    super(`${contract}: ${message}`);
    this.name = 'ContractError';
  }
}
