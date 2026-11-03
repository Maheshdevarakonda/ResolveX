import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as controller from "./organization.controller";
import {
  listMembersQuerySchema,
  memberParamsSchema,
  updateOrganizationSchema,
} from "./organization.schema";

const router = Router();

// Everything here is for ADMINs of the caller's own organization.
router.use(authenticate, authorize("ADMIN"));

router.get("/", controller.get);
router.patch("/", validate({ body: updateOrganizationSchema }), controller.update);
router.get("/members", validate({ query: listMembersQuerySchema }), controller.listMembers);
router.get("/members/:userId", validate({ params: memberParamsSchema }), controller.getMember);

export default router;
