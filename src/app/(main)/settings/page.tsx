"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

export default function SettingsPage() {
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("");
  const [siliconKey, setSiliconKey] = useState("");
  const [siliconModel, setSiliconModel] = useState("");

  useEffect(() => {
    setDeepseekKey(localStorage.getItem("ai_deepseek_key") || "");
    setDeepseekModel(localStorage.getItem("ai_deepseek_model") || "deepseek-v4-pro");
    setSiliconKey(localStorage.getItem("ai_silicon_key") || "");
    setSiliconModel(localStorage.getItem("ai_silicon_model") || "deepseek-ai/DeepSeek-R1");
  }, []);

  function save() {
    localStorage.setItem("ai_deepseek_key", deepseekKey);
    localStorage.setItem("ai_deepseek_model", deepseekModel);
    localStorage.setItem("ai_silicon_key", siliconKey);
    localStorage.setItem("ai_silicon_model", siliconModel);
    toast.success("设置已保存");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl">设置</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 模型配置</p>
      </motion.div>

      {/* DeepSeek */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">DeepSeek (主模型)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">API Key</Label>
              <Input type="password" value={deepseekKey} onChange={(e) => setDeepseekKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div>
              <Label className="text-xs">模型</Label>
              <Select value={deepseekModel} onValueChange={(v) => setDeepseekModel(v || "deepseek-v4-pro")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek-v4-pro">deepseek-v4-pro</SelectItem>
                  <SelectItem value="deepseek-chat">deepseek-chat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* SiliconFlow Fallback */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">SiliconFlow (备用)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">API Key</Label>
              <Input type="password" value={siliconKey} onChange={(e) => setSiliconKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div>
              <Label className="text-xs">模型</Label>
              <Select value={siliconModel} onValueChange={(v) => setSiliconModel(v || "deepseek-ai/DeepSeek-R1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek-ai/DeepSeek-R1">DeepSeek-R1</SelectItem>
                  <SelectItem value="deepseek-ai/DeepSeek-V3">DeepSeek-V3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} initial="hidden" animate="show">
        <Button onClick={save} className="w-full">
          <Save className="h-4 w-4 mr-2" />保存设置
        </Button>
      </motion.div>
    </div>
  );
}
