import { Router } from "express";
import * as controller from "./demo.controller";

const router = Router();

// Public endpoints with no credentials required - enables instant recruiter access
router.post("/session", controller.createDemoSession);
router.post("/reset", controller.resetDemo);

export default router;
