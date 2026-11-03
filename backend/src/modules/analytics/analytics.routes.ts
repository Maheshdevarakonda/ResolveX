import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./analytics.service";

const router = Router();
router.use(authenticate);

router.get("/summary", authorize("ADMIN"), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.summary(req.user!.organizationId));
}));

router.get("/by-department", authorize("ADMIN"), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.byDepartment(req.user!.organizationId));
}));

router.get(
  "/trends",
  authorize("ADMIN"),
  validate({ query: z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }) }),
  asyncHandler(async (req, res) => {
    const { days } = req.query as unknown as { days: number };
    sendSuccess(res, await service.trends(req.user!.organizationId, days));
  })
);

// Admins see every employee; an employee sees only their own numbers.
router.get("/workload", authorize("ADMIN", "EMPLOYEE"), asyncHandler(async (req, res) => {
  const only = req.user!.role === "EMPLOYEE" ? req.user!.id : undefined;
  sendSuccess(res, await service.workload(req.user!.organizationId, only));
}));

export default router;
