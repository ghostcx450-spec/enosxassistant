import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import powerRouter from "./power";

const router: IRouter = Router();

router.use("/", healthRouter);
router.use("/", chatRouter);
router.use("/system", powerRouter);

// Catch-all 404 handler for unmapped routes
router.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default router;
