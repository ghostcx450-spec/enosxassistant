import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { SystemAction } from "@/hooks/useCommandChain";

interface PowerConfirmationProps {
  isOpen: boolean;
  action: SystemAction | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PowerConfirmation({
  isOpen,
  action,
  onConfirm,
  onCancel,
}: PowerConfirmationProps) {
  if (!action) return null;

  const getWarningMessage = () => {
    switch (action.type) {
      case "shutdown":
        return "Your computer will turn off immediately. All unsaved work will be lost.";
      case "restart":
        return "Your computer will restart immediately. All unsaved work will be lost.";
      default:
        return "Are you sure you want to proceed?";
    }
  };

  const getActionLabel = () => {
    return action.type.charAt(0).toUpperCase() + action.type.slice(1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto bg-gradient-to-br from-slate-900 to-slate-800 border border-red-500/30 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Confirm {getActionLabel()}
                  </h3>
                </div>
                <button
                  onClick={onCancel}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message */}
              <p className="text-slate-300 mb-6 leading-relaxed">
                {getWarningMessage()}
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                    action.type === "shutdown" || action.type === "restart"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {getActionLabel()}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
