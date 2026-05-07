"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, ChevronDown, ChevronRight, Brain, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  timestamp: number;
}

interface ParsedTask {
  name: string;
  category: string;
  minutes: number;
}

const SYSTEM_PROMPT = `你是一个考研备考助手。用户是医学生，备考方向是口腔医学+英语。
请用中文回答，风格亲切简洁。

当用户提供任务计划时，请用以下格式输出可解析的任务：
「任务名|分类|预计分钟数」
分类必须是: english | dental | other

例如：
「背单词100个|english|45」
「口腔修复学复习|dental|60」

用户可以使用以下命令：
/学习 - 学习任务计划
/饮食 - 饮食营养分析
/健身 - 运动健身建议
/日程 - 明日学习安排
/分析 - 综合分析`;

function parseTasks(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const seen = new Set<string>();
  const VALID_CAT = ["english", "dental", "other"];
  const lines = text.split("\n");

  for (const line of lines) {
    let m: RegExpMatchArray | null = null;
    m = line.match(/[「【]([^|｜]+)[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)[」\]】]/i);
    if (!m) m = line.match(/^\s*[-*]\s*(.+?)\s*[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)/i);
    if (!m) m = line.match(/^(\S.{2,}?)\s*[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)/i);

    if (m) {
      const name = m[1].trim();
      const cat = m[2].toLowerCase();
      const mins = parseInt(m[3]);
      const key = `${name}|${cat}`;
      if (VALID_CAT.includes(cat) && !seen.has(key) && mins > 0) {
        seen.add(key);
        tasks.push({ name, category: cat, minutes: mins });
      }
    }
  }
  return tasks;
}

function getAIKeys() {
  return {
    primaryKey: localStorage.getItem("ai_deepseek_key") || "sk-0fb0a98da71a46388a7701b842ecd438",
    primaryModel: localStorage.getItem("ai_deepseek_model") || "deepseek-v4-pro",
    fallbackKey: localStorage.getItem("ai_silicon_key") || "sk-lldpkkegjmpexefnwqijwkouvijszfnuzamqxofutkkzirro",
    fallbackModel: localStorage.getItem("ai_silicon_model") || "deepseek-ai/DeepSeek-R1",
  };
}

const messageItem = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"day" | "week">("day");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const streamChat = useCallback(async (prompt: string) => {
    const keys = getAIKeys();
    const fullPrompt = mode === "week"
      ? `这是本周的数据分析请求：${prompt}`
      : `今天的日期是 ${getToday()}。${prompt}`;

    const body: Record<string, unknown> = {
      model: keys.primaryModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fullPrompt },
      ],
      stream: true,
      max_tokens: 4096,
      thinking: { type: "enabled" },
      reasoning_effort: "max",
    };

    abortRef.current = new AbortController();

    try {
      let content = "";
      let reasoning = "";
      const msgId = `msg-${Date.now()}`;

      setMessages((prev) => [...prev, { id: msgId, role: "assistant", content: "...", timestamp: Date.now() }]);

      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.primaryKey}` },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (delta?.reasoning_content) {
              reasoning += delta.reasoning_content;
              setMessages((prev) =>
                prev.map((m) => (m.id === msgId ? { ...m, reasoning } : m))
              );
            }
            if (delta?.content) {
              content += delta.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === msgId ? { ...m, content } : m))
              );
            }
          } catch {}
        }
      }

      // If empty content, show reasoning as content
      if (!content && reasoning) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: reasoning } : m))
        );
      }
    } catch (e: unknown) {
      const err = e as Error;
      if (err.name === "AbortError") return;
      toast.error(`AI 连接失败: ${err.message}`);
      setMessages((prev) => prev.filter((m) => m.content !== "..."));
    }
  }, [mode]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, role: "user", content: prompt, timestamp: Date.now() }]);
    await streamChat(prompt);
    setLoading(false);
  }

  function handleStop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function adoptTasks(text: string) {
    const tasks = parseTasks(text);
    if (tasks.length === 0) {
      toast.error("未识别到任务格式");
      return;
    }
    // Save to today's daily plan
    import("@/lib/db").then(async ({ getDailyPlan, saveDailyPlan }) => {
      try {
        const today = getToday();
        const plan = await getDailyPlan(today);
        const existing = plan?.tasks || [];
        const newTasks = tasks.map((t, i) => ({
          id: `ai-${Date.now()}-${i}`,
          text: t.name,
          category: t.category as "english" | "dental" | "other",
          status: "pending" as const,
          plannedMinutes: t.minutes,
          actualMinutes: 0,
          timerAccumulated: 0,
        }));
        await saveDailyPlan({
          date: today,
          tasks: [...existing, ...newTasks],
          conquered: plan?.conquered || "",
          difficulty: plan?.difficulty || "",
          adjust: plan?.adjust || "",
          completion: plan?.completion || "",
          totalFocusMinutes: (plan?.totalFocusMinutes || 0) + tasks.reduce((s, t) => s + t.minutes, 0),
        });
        toast.success(`已采纳 ${tasks.length} 个任务`);
      } catch (e) {
        toast.error("采纳失败");
      }
    });
  }

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-heading text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 助手
          </h1>
          <p className="text-sm text-muted-foreground mt-1">DeepSeek V4 Pro</p>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day" className="text-xs">今日</TabsTrigger>
            <TabsTrigger value="week" className="text-xs">本周</TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Messages */}
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 text-muted-foreground"
            >
              <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">输入 /学习 或 /日程 开始规划</p>
              <div className="flex gap-1 justify-center mt-3">
                {["/学习", "/饮食", "/健身", "/日程", "/分析"].map((cmd) => (
                  <Badge key={cmd} variant="outline" className="cursor-pointer text-xs" onClick={() => setInput(cmd + " ")}>
                    {cmd}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              variants={messageItem}
              initial="hidden"
              animate="visible"
              className={`mb-4 ${msg.role === "user" ? "flex justify-end" : ""}`}
            >
              <Card className={`max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                <CardContent className="p-3">
                  {/* Reasoning (collapsible) */}
                  {msg.reasoning && (
                    <Collapsible
                      open={reasoningOpen[msg.id]}
                      onOpenChange={(o) => setReasoningOpen((prev) => ({ ...prev, [msg.id]: o }))}
                      className="mb-2"
                    >
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <Brain className="h-3 w-3" />
                        思考过程
                        {reasoningOpen[msg.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">
                          {msg.reasoning}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  {/* Content */}
                  <div className={`text-sm whitespace-pre-wrap ${msg.content === "..." ? "animate-pulse" : ""}`}>
                    {msg.content}
                  </div>
                  {/* Adopt tasks button (assistant messages only) */}
                  {msg.role === "assistant" && parseTasks(msg.content).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => adoptTasks(msg.content)}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      采纳 {parseTasks(msg.content).length} 个任务
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>

      {/* Input */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="shrink-0">
        <Card>
          <CardContent className="p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              {loading ? (
                <Button variant="outline" size="icon" onClick={handleStop}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              ) : (
                <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
