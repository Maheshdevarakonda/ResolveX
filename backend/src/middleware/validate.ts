import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

// Usage in a route:  router.post("/", validate({ body: createComplaintSchema }), controller)
// Invalid input throws a ZodError, which the central error handler turns into a 400.
interface Schemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as Request["query"];
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request["params"];
      next();
    } catch (err) {
      next(err);
    }
  };
