import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { ApiError } from "../../utils/ApiError";
import { idParamsSchema } from "../../utils/validators";
import { createCommentSchema } from "../comments/comment.service";
import { feedbackSchema } from "../feedback/feedback.service";
import { ALLOWED_MIME, MAX_ATTACHMENTS, MAX_FILE_BYTES } from "./attachment.service";
import * as controller from "./complaint.controller";
import {
  assignSchema,
  createComplaintSchema,
  listComplaintsQuerySchema,
  prioritySchema,
  reopenSchema,
  statusSchema,
} from "./complaint.schema";

// Files stay in memory just long enough to stream them to Cloudinary (nothing is written to disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_ATTACHMENTS },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest("Only PNG, JPEG, WebP images and PDF files are allowed"));
  },
});

const router = Router();
router.use(authenticate);

const params = validate({ params: idParamsSchema });

router.get("/stats", controller.stats); // before "/:id" so "stats" is not read as an id
router.post("/", authorize("CUSTOMER"), validate({ body: createComplaintSchema }), controller.create);
router.get("/", validate({ query: listComplaintsQuerySchema }), controller.list);
router.get("/:id", params, controller.get);

router.patch("/:id/assign", authorize("ADMIN"), validate({ params: idParamsSchema, body: assignSchema }), controller.assign);
router.post("/:id/accept", authorize("EMPLOYEE"), params, controller.accept);
router.patch(
  "/:id/status",
  authorize("ADMIN", "EMPLOYEE"),
  validate({ params: idParamsSchema, body: statusSchema }),
  controller.changeStatus
);
router.patch(
  "/:id/priority",
  authorize("ADMIN", "EMPLOYEE"),
  validate({ params: idParamsSchema, body: prioritySchema }),
  controller.updatePriority
);
router.post("/:id/close", authorize("ADMIN", "CUSTOMER"), params, controller.close);
router.post(
  "/:id/reopen",
  authorize("CUSTOMER"),
  validate({ params: idParamsSchema, body: reopenSchema }),
  controller.reopen
);

router.get("/:id/comments", params, controller.comments);
router.post("/:id/comments", validate({ params: idParamsSchema, body: createCommentSchema }), controller.createComment);

router.post("/:id/attachments", params, upload.array("files", MAX_ATTACHMENTS), controller.attachments);

router.get("/:id/feedback", params, controller.feedback);
router.post(
  "/:id/feedback",
  authorize("CUSTOMER"),
  validate({ params: idParamsSchema, body: feedbackSchema }),
  controller.createFeedback
);

export default router;
