import { Router, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

// Track recent power commands for rate limiting
const recentCommands: { [key: string]: number[] } = {};
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_COMMANDS_PER_WINDOW = 2;

// Power command types
type PowerAction = "shutdown" | "sleep" | "restart" | "wake";

interface PowerRequest {
  action: PowerAction;
  confirm?: boolean;
  reason?: string;
}

/**
 * Execute system power command
 * Supports: shutdown, restart, sleep
 */
router.post("/power", async (req: Request, res: Response) => {
  try {
    const { action, confirm, reason } = req.body as PowerRequest;

    // Validate action
    if (!["shutdown", "sleep", "restart", "wake"].includes(action)) {
      return res.status(400).json({
        error: "Invalid power action",
        message: `Action must be one of: shutdown, sleep, restart, wake. Got: ${action}`,
      });
    }

    // Require confirmation for destructive actions
    if (["shutdown", "restart"].includes(action) && !confirm) {
      return res.status(200).json({
        status: "confirmation_required",
        action,
        message: `This will ${action} the computer. Please confirm to proceed.`,
      });
    }

    // Rate limiting
    const clientIp = req.ip || "unknown";
    const now = Date.now();
    
    if (!recentCommands[clientIp]) {
      recentCommands[clientIp] = [];
    }

    // Clean old commands
    recentCommands[clientIp] = recentCommands[clientIp].filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    );

    // Check rate limit
    if (recentCommands[clientIp].length >= MAX_COMMANDS_PER_WINDOW) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many power commands. Please wait before trying again.",
      });
    }

    // Log the command
    console.log(`[Power Command] ${action} from ${clientIp}${reason ? ` - Reason: ${reason}` : ""}`);

    // Execute appropriate command
    let command = "";
    switch (action) {
      case "shutdown":
        command = "sudo shutdown -h now";
        break;
      case "restart":
        command = "sudo shutdown -r now";
        break;
      case "sleep":
        command = "systemctl suspend";
        break;
      case "wake":
        // Wake-on-LAN would require network config
        return res.status(501).json({
          error: "Not implemented",
          message: "Wake functionality requires network configuration",
        });
    }

    try {
      // Execute command
      const { stdout, stderr } = await execAsync(command);
      
      recentCommands[clientIp].push(now);

      return res.json({
        status: "success",
        action,
        message: `Computer will ${action}...`,
        timestamp: new Date().toISOString(),
      });
    } catch (execError: any) {
      // Command execution failed
      console.error(`[Power Command Error] ${action}: ${execError.message}`);
      
      // Check for permission denied
      if (execError.message.includes("EACCES") || execError.stderr?.includes("sudo")) {
        return res.status(403).json({
          error: "Permission denied",
          message: "The API server does not have permissions to execute power commands. Try running with sudo.",
        });
      }

      return res.status(500).json({
        error: "Command execution failed",
        message: execError.message,
      });
    }
  } catch (error: any) {
    console.error("[Power Route Error]", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

export default router;
