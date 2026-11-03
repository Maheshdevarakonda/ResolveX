import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { idParamsSchema } from "../../utils/validators";
import * as controller from "./user.controller";
import {
  createEmployeeSchema,
  listUsersQuerySchema,
  updateMeSchema,
  updateUserSchema,
} from "./user.schema";

const router = Router();

router.use(authenticate);

// Any logged-in user may edit their own profile. This must come BEFORE "/:id".
router.patch("/me", validate({ body: updateMeSchema }), controller.updateMe);

// Everything below is ADMIN only.
router.use(authorize("ADMIN"));

router.post("/employees", validate({ body: createEmployeeSchema }), controller.createEmployee);
router.get("/", validate({ query: listUsersQuerySchema }), controller.list);
router.get("/:id", validate({ params: idParamsSchema }), controller.get);
router.patch("/:id", validate({ params: idParamsSchema, body: updateUserSchema }), controller.update);

export default router;
