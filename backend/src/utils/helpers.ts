export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
  }
}

export const asyncHandler = <T>(
  fn: (req: any, res: any, next: any) => Promise<T>
) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const generateUUID = (): string => {
  return crypto.randomUUID();
};
