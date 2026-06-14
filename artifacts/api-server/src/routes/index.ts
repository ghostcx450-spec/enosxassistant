import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use("/", healthRouter);
router.use("/", chatRouter);

// Catch-all 404 handler for unmapped routes
router.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default router;
