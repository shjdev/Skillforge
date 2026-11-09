/** Erreur dont le message peut être montré tel quel, avec son code HTTP. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
