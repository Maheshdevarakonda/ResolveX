import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { idParamsSchema } from "../../utils/validators";
import * as controller from "./department.controller";
import { createDepartmentSchema, updateDepartmentSchema } from "./department.schema";

const router = Router();

router.use(authenticate);

// Staff can see departments (e.g. to route a complaint); only admins change them.
router.get("/", authorize("ADMIN", "EMPLOYEE"), controller.list);
router.post("/", authorize("ADMIN"), validate({ body: createDepartmentSchema }), controller.create);
router.patch(
  "/:id",
  authorize("ADMIN"),
  validate({ params: idParamsSchema, body: updateDepartmentSchema }),
  controller.update
);
router.delete("/:id", authorize("ADMIN"), validate({ params: idParamsSchema }), controller.remove);

export default router;
