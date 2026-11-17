/** Base class for every error thrown by this library. */
export class WebAiStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebAiStorageError";
  }
}

/** Thrown when an argument is missing, negative, NaN or otherwise unusable. */
export class InvalidInputError extends WebAiStorageError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

/** Thrown when a Hugging Face file size lookup fails. */
export class HfLookupError extends WebAiStorageError {
  readonly file: string;
  readonly status: number | null;
  constructor(file: string, status: number | null, detail: string) {
    super(`Could not look up the size of "${file}"${status === null ? "" : ` (HTTP ${status})`}: ${detail}`);
    this.name = "HfLookupError";
    this.file = file;
    this.status = status;
  }
}
