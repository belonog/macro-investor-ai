export class StaleRegimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleRegimeError';
  }
}
