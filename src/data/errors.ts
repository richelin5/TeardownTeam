/** Typed errors (engineering-standards). Messages are safe to show to users: never put URLs, keys or upstream bodies in them. */
export class BadRequestError extends Error {
  override name = "BadRequestError";
}
export class NotFoundError extends Error {
  override name = "NotFoundError";
}
/** The ticker is not in the SEC ticker map (as opposed to a missing CIK resource). */
export class TickerNotFoundError extends NotFoundError {
  override name = "TickerNotFoundError";
}
export class UnsupportedFilerError extends Error {
  override name = "UnsupportedFilerError";
}
export class UpstreamError extends Error {
  override name = "UpstreamError";
  constructor(
    readonly service: "sec" | "fred",
    readonly status: number,
    message = "Upstream data source unavailable",
  ) {
    super(message);
  }
}
export class ConfigError extends Error {
  override name = "ConfigError";
}
