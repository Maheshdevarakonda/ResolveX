import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { auditFromRequest } from "../audit/audit.service";
import { savePolicies, listPolicies } from "./sla.service";
import { savePoliciesSchema } from "./sla.schema";

const router = Router();
router.use(authenticate, authorize("ADMIN"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listPolicies(req.user!.organizationId));
  })
);

router.put(
  "/",
  validate({ body: savePoliciesSchema }),
  asyncHandler(async (req, res) => {
    const before = await listPolicies(req.user!.organizationId);
    const after = await savePolicies(req.user!.organizationId, req.body.policies);
    await auditFromRequest(req, {
      action: "SLA_POLICY_UPDATED",
      entityType: "SLA_POLICY",
      changes: { before, after },
    });
    sendSuccess(res, after, "SLA policies saved");
  })
);

export default router;
