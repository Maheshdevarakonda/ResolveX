import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  registerCustomerSchema,
  registerOrgSchema,
  resetPasswordSchema,
} from "./auth.schema";

const router = Router();

router.post("/register-org", authLimiter, validate({ body: registerOrgSchema }), controller.registerOrg);
router.post("/register", authLimiter, validate({ body: registerCustomerSchema }), controller.registerCustomer);
router.post("/login", authLimiter, validate({ body: loginSchema }), controller.login);
router.post("/refresh", authLimiter, controller.refresh);
router.post("/logout", controller.logout);
router.post("/forgot-password", authLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post("/reset-password", authLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);
router.get("/me", authenticate, controller.me);

export default router;
