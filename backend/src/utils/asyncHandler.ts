import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch errors from async functions by itself.
// This wrapper forwards any rejected promise to the central error handler,
// so controllers never need their own try/catch.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
