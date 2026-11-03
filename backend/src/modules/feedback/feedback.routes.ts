import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { paginationFields } from "../../utils/pagination";
import { listFeedback } from "./feedback.service";

const router = Router();
router.use(authenticate, authorize("ADMIN"));

router.get(
  "/",
  validate({ query: z.object({ ...paginationFields }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; limit: number };
    const { items, meta } = await listFeedback(req.user!.organizationId, q.page, q.limit);
    sendSuccess(res, items, "OK", 200, { ...meta });
  })
);

export default router;
