export interface AppErrorReason {
  type: string;
  message: string;
}

export class AppError extends Error {
  public reasons?: AppErrorReason[];

  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
    public errorCode?: string
  ) {
    super(message);
    this.name = 'AppError';
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
