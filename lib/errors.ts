export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
