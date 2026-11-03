import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { paginationFields } from "../../utils/pagination";
import { idParamsSchema } from "../../utils/validators";
import * as service from "./notification.service";

const router = Router();
router.use(authenticate); // every role can read their own notifications

const listQuery = z.object({
  ...paginationFields,
  unread: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

router.get(
  "/",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; limit: number; unread?: boolean };
    const { items, meta } = await service.listNotifications(
      req.user!.organizationId,
      req.user!.id,
      q.page,
      q.limit,
      q.unread === true
    );
    sendSuccess(res, items, "OK", 200, { ...meta });
  })
);

// "read-all" is declared before "/:id/read" for clarity; the paths do not clash.
router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    const updated = await service.markAllRead(req.user!.organizationId, req.user!.id);
    sendSuccess(res, { updated }, "All notifications marked as read");
  })
);

router.patch(
  "/:id/read",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res) => {
    const notification = await service.markRead(req.user!.organizationId, req.user!.id, req.params.id);
    sendSuccess(res, { notification });
  })
);

export default router;
