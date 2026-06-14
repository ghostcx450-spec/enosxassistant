/*
 * ENOSX XAI Assistant — ChatPage (Enhanced)
 * Design: "Crimson Matrix" — Cyberpunk Glassmorphism
 * Layout: Left floating acrylic sidebar + right bento chat area + floating pill command bar
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import MessageBubble from "@/components/MessageBubble";
import CommandBar from "@/components/CommandBar";
import WelcomeScreen from "@/components/WelcomeScreen";
import PulseOrb from "@/components/PulseOrb";
import FileDropZone from "@/components/FileDropZone";
import GodModeTerminal from "@/components/GodModeTerminal";
import CircuitDoor from "@/components/CircuitDoor";
import { GlobalLayout } from "@/components/GlobalLayout";
import { useGroq as useAI } from "@/hooks/useGroq";
import { useVoice } from "@/hooks/useVoice";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useSystemActions } from "@/hooks/useSystemActions";
import { useCommandChain } from "@/hooks/useCommandChain";
import { useContextAwareMessages } from "@/hooks/useContextAwareMessages";
import { useActiveWindow } from "@/contexts/WindowContext";
import { useFileContext } from "@/hooks/useFileContext";
import { useClipboardListener } from "@/hooks/useClipboardListener";
import { useGodMode } from "@/hooks/useGodMode";
import { useMemoryBank } from "@/hooks/useMemoryBank";
import { Conversation, Message } from "@/lib/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompactMode } from "@/hooks/useCompactMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, Wifi, Menu } from "lucide-react";

// Declare global window interface for settings handler
declare global {
  interface Window {
    __openBackgroundPicker?: () => void;
  }
}

const createAdaptiveActionHandler = (handleSend: (msg: string) => void) => (action: string) => {
  handleSend(action);
};

const createClipboardSummarizeHandler = (handleSend: (msg: string) => void) => (text: string) => {
  handleSend(`Summarize this clipboard content: ${text}`);
};

const BG_URL = "/lavender-field-optimized.webp";

function createConversation(): Conversation {
  return {
    id: nanoid(),
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateTitle(firstMessage: string): string {
  const words = firstMessage.trim().split(/\s+/).slice(0, 6);
  return words.join(" ") + (firstMessage.split(/\s+/).length > 6 ? "..." : "");
}

export default function ChatPage() {
  const { config } = useTheme();
  const [isBgLoaded, setIsBgLoaded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  // Keep refs in sync
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const { sendMessage, isLoading, error } = useAI();

  const {
    voiceState,
    transcript,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice();

  const { play: playSound, setEnabled: setSoundFn } = useSoundEffects();
  const { executeAction } = useSystemActions();
  const { enrichMessageWithContext, getAppSpecificSuggestions } = useContextAwareMessages();
  const { activeWindow } = useActiveWindow();
  const { fileContext, loadFile, clearFile, getFileContextMessage } = useFileContext();
  const {
    copiedText,
  } = useClipboardListener();

  const { memories, addMemory, removeMemory, getMemoryContext } = useMemoryBank();

  const [isGodModeActive, setIsGodModeActive] = useState(false);
  const [showGodTerminal, setShowGodTerminal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isCompactMode, toggleCompactMode } = useCompactMode();
  const isMobile = useIsMobile();

  // handleSend defined early to avoid circular dependencies
  const handleSend = useCallback(
    async (text: string) => {
      let convId = activeIdRef.current;

      if (!convId) {
        const conv = createConversation();
        conv.title = generateTitle(text);
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        convId = conv.id;
        await new Promise((r) => setTimeout(r, 0));
      }

      const targetConvId = convId;
      let messageContent = text;
      if (fileContext.isLoaded) {
        messageContent += getFileContextMessage();
      }

      const userMessage: Message = {
        id: nanoid(),
        role: "user",
        content: messageContent,
        timestamp: new Date(),
      };

      const assistantId = nanoid();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      const currentMessages =
        conversationsRef.current.find((c) => c.id === targetConvId)?.messages ?? [];

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          return {
            ...c,
            messages: [...c.messages, userMessage, assistantMessage],
            updatedAt: new Date(),
            title: c.messages.length === 0 ? generateTitle(text) : c.title,
          };
        })
      );

      playSound("send");

      if (fileContext.isLoaded) {
        clearFile();
      }

      const memoryContext = getMemoryContext();
      
      const enrichedUserMessage = {
        ...userMessage,
        content: userMessage.content + memoryContext
      };

      const contextEnrichedMessages = enrichMessageWithContext([...currentMessages, enrichedUserMessage], activeWindow);
      let fullResponse = "";

      try {
        await sendMessage(
          contextEnrichedMessages,
          (chunk) => {
            fullResponse += chunk;
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConvId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: fullResponse } : m
                  ),
                };
              })
            );
          },
          () => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConvId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                  ),
                };
              })
            );
            playSound("receive");
            executeAction(fullResponse);

            if (autoSpeak && fullResponse) {
              setSpeakingMessageId(assistantId);
              speak(fullResponse, () => setSpeakingMessageId(null));
            }
          }
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to fetch response";
        toast.error(errorMsg);
        
        // Remove the empty assistant message on error
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== targetConvId) return c;
            return {
              ...c,
              messages: c.messages.filter((m) => m.id !== assistantId),
            };
          })
        );
      }
    },
    [sendMessage, speak, autoSpeak, playSound, fileContext, getFileContextMessage, clearFile, getMemoryContext, enrichMessageWithContext, activeWindow, executeAction]
  );

  const triggerGodMode = useCallback(() => {
    if (isGodModeActive) return;
    setIsGodModeActive(true);
    playSound("godMode");
    
    // Auto-transition to terminal after animation completes (3s total duration)
    setTimeout(() => {
      setIsGodModeActive(false);
      setShowGodTerminal(true);
      
      // Check for custom greeting in memories
      const customGreeting = memories.find(m => m.category === 'system' && m.content.startsWith('GREETING_OVERRIDE:'));
      const greetingText = customGreeting 
        ? customGreeting.content.replace('GREETING_OVERRIDE:', '').trim()
        : "Greetings, Enosh. How may I assist you today?";
        
      speak(greetingText);
    }, 3000);
  }, [isGodModeActive, playSound, speak, memories]);

  useGodMode(triggerGodMode);

  const handleGodModeAnimationComplete = useCallback(() => {
    if (isGodModeActive) {
      setShowGodTerminal(true);
    }
  }, [isGodModeActive]);

  const handleScreenshot = useCallback(
    (imageData: string) => {
      const prompt = `[SCREENSHOT ANALYSIS]\n\nPlease analyze this screenshot and provide insights:\n\n<image>${imageData}</image>`;
      handleSend(prompt);
    },
    [handleSend]
  );

  const executeGodCommand = useCallback(async (command: string) => {
    const prompt = `[GOD MODE COMMAND] ${command}`;
    await handleSend(prompt);
    return "Command executed via ENOSX Core.";
  }, [handleSend]);

  useEffect(() => {
    setSoundFn(soundEnabled);
  }, [soundEnabled, setSoundFn]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (activeConversation?.messages.length) {
      scrollToBottom();
    }
  }, [activeConversation?.messages.length, scrollToBottom]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  };

  useEffect(() => {
    if (error) {
      toast.error(`API Error: ${error}`);
      playSound("error");
    }
  }, [error, playSound]);

  useEffect(() => {
    const img = new Image();
    img.src = BG_URL;
    img.onload = () => setIsBgLoaded(true);
  }, []);

  const createNewChat = useCallback(() => {
    const conv = createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    playSound("click");
  }, [playSound]);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
      }
      playSound("click");
    },
    [activeId, playSound]
  );

  const handleVoiceResult = useCallback(
    (text: string) => {
      setAutoSpeak(true);
      handleSend(text);
    },
    [handleSend]
  );

  const handleStartVoice = useCallback(() => {
    playSound("listenStart");
    startListening(handleVoiceResult);
  }, [startListening, handleVoiceResult, playSound]);

  const handleSpeak = useCallback(
    (text: string, messageId: string) => {
      setSpeakingMessageId(messageId);
      speak(text, () => setSpeakingMessageId(null));
    },
    [speak]
  );

  const handleStopSpeak = useCallback(() => {
    stopSpeaking();
    setSpeakingMessageId(null);
    playSound("listenStop");
  }, [stopSpeaking, playSound]);

  const messages = activeConversation?.messages ?? [];

  return (
    <GlobalLayout>
      <div
        className={`flex h-dvh w-screen overflow-hidden ${isCompactMode ? "rounded-3xl border-2 shadow-2xl" : ""}`}
        style={{ 
          background: config.bg, 
          transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          borderColor: isCompactMode ? `rgba(${config.accentRgb}, 0.3)` : "transparent"
        }}
      >
      {/* Tiny placeholder for instant load */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "url('/lavender-field-tiny.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(20px)",
        }}
      />
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-1000 ${isBgLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <FileDropZone onFileSelected={loadFile} isActive={true} />
      
      {/* Desktop sidebar — hidden on mobile */}
      {!isCompactMode && !isMobile && (
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={createNewChat}
          onDelete={deleteConversation}
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onSettingsClick={() => {
            if (typeof window !== 'undefined' && (window as any).__openBackgroundPicker) {
              (window as any).__openBackgroundPicker();
            }
          }}
        />
      )}

      {/* Mobile sidebar — drawer overlay */}
      {isMobile && (
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setIsMobileSidebarOpen(false); }}
          onNew={() => { createNewChat(); setIsMobileSidebarOpen(false); }}
          onDelete={deleteConversation}
          collapsed={false}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
          onSettingsClick={() => {
            setIsMobileSidebarOpen(false);
            if (typeof window !== 'undefined' && (window as any).__openBackgroundPicker) {
              (window as any).__openBackgroundPicker();
            }
          }}
        />
      )}

      <main className="flex-1 flex flex-col relative min-w-0">

        {/* Mobile top bar */}
        {isMobile && !isCompactMode && (
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0 z-20 relative"
            style={{
              background: `rgba(7,8,12,0.85)`,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderBottom: `1px solid rgba(${config.accentRgb}, 0.1)`,
            }}
          >
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid rgba(${config.accentRgb}, 0.15)`,
                color: config.textMuted,
              }}
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-white text-xs shadow-[0_0_10px_rgba(124,111,247,0.5)]"
                   style={{ background: 'linear-gradient(135deg, #7c6ff7, #a78bfa)' }}>
                EX
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: config.text }}>
                ENOSX AI
              </span>
            </div>
            <div className="w-9 h-9" />
          </div>
        )}

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <WelcomeScreen onSuggestion={handleSend} isCompact={isCompactMode} />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col"
              >
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className={`flex-1 overflow-y-auto px-4 ${isCompactMode ? "" : "md:px-8"} py-6 scrollbar-thin`}
                >
                  <div className={`max-w-3xl mx-auto space-y-6 ${isCompactMode ? "px-2" : ""}`}>
                    {messages.map((m, idx) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        index={idx}
                        onSpeak={() => handleSpeak(m.content, m.id)}
                        onStopSpeak={handleStopSpeak}
                        isSpeaking={speakingMessageId === m.id}
                      />
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                </div>

                <AnimatePresence>
                  {showScrollBtn && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollToBottom()}
                      className="absolute bottom-4 right-8 p-2 rounded-full shadow-lg z-20 border"
                      style={{
                        background: "rgba(20, 20, 20, 0.8)",
                        backdropFilter: "blur(10px)",
                        borderColor: `rgba(${config.accentRgb}, 0.2)`,
                        color: config.text,
                      }}
                    >
                      <ChevronDown size={20} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={`p-4 ${isCompactMode ? "pb-6" : "md:p-6"} z-20`}>
          <div className="max-w-3xl mx-auto relative">
            <CommandBar
              onSend={handleSend}
              isLoading={isLoading}
              isVoiceSupported={isVoiceSupported}
              onStartVoice={handleStartVoice}
              onStopVoice={stopListening}
              onStopSpeaking={handleStopSpeak}
              voiceState={voiceState}
              transcript={transcript}
            />
          </div>
        </div>

        <AnimatePresence>
          {isGodModeActive && (
            <CircuitDoor 
              isActive={isGodModeActive} 
              onAnimationComplete={handleGodModeAnimationComplete}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showGodTerminal && (
            <GodModeTerminal 
              isOpen={showGodTerminal}
              onClose={() => {
                setShowGodTerminal(false);
                setIsGodModeActive(false);
              }}
              onExecute={executeGodCommand}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
    </GlobalLayout>
  );
}
