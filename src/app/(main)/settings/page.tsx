"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getOrCreateProfile, updateProfile, type Profile } from "@/lib/db";

const item={hidden:{opacity:0,y:12},show:{opacity:1,y:0,transition:{duration:0.3,ease:"easeOut" as const}}};

export default function SettingsPage(){
  const[profile,setProfile]=useState<Profile|null>(null);
  const[apiStatus,setApiStatus]=useState<{ok:boolean;message:string}>({ok:false,message:"检查中..."});

  useEffect(()=>{
    getOrCreateProfile().then(setProfile);
    // Check API route health
    fetch("/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:"hi"}]})})
      .then(r=>r.json()).then(d=>{if(d.error)setApiStatus({ok:false,message:d.error});else setApiStatus({ok:true,message:"连接正常"});})
      .catch(()=>setApiStatus({ok:false,message:"无法连接 API"}));
  },[]);

  async function handleSaveProfile(){if(!profile)return;try{await updateProfile(profile);toast.success("资料已保存");}catch(e){toast.error("保存失败");}}
  const update=(f:keyof Profile,v:any)=>{if(!profile)return;setProfile({...profile,[f]:v});};

  return <div className="space-y-6 max-w-xl">
    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><h1 className="font-heading text-2xl">设置</h1></motion.div>

    <motion.div variants={item} initial="hidden" animate="show">
      <Card><CardHeader><CardTitle className="text-base">个人资料</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs mb-1">身高 (cm)</Label><Input type="number" value={profile?.height||""} onChange={e=>update("height",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">体重 (kg)</Label><Input type="number" value={profile?.weight||""} onChange={e=>update("weight",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">年龄</Label><Input type="number" value={profile?.age||""} onChange={e=>update("age",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">性别</Label><Select value={profile?.gender||"male"} onValueChange={(v)=>update("gender",v||"male")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="male">男</SelectItem><SelectItem value="female">女</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs mb-1">目标体重 (kg)</Label><Input type="number" value={profile?.targetWeight||""} onChange={e=>update("targetWeight",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">目标体脂 (%)</Label><Input type="number" value={profile?.targetBodyFat||""} onChange={e=>update("targetBodyFat",Number(e.target.value))}/></div>
          <div className="col-span-2"><Label className="text-xs mb-1">目标日期</Label><Input type="date" value={profile?.targetDate||""} onChange={e=>update("targetDate",e.target.value)}/></div>
        </div>
        <Button onClick={handleSaveProfile} className="w-full">保存资料</Button>
      </CardContent></Card>
    </motion.div>

    <Separator/>

    <motion.div variants={item} initial="hidden" animate="show">
      <Card><CardHeader><CardTitle className="text-base">AI 模型</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">DeepSeek V4 Pro + SiliconFlow 备用</span>
          <Badge variant={apiStatus.ok?"default":"destructive"} className="text-xs">{apiStatus.ok?"已连接":"未配置"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{apiStatus.message}</p>
        <p className="text-xs text-muted-foreground">API Key 在 Vercel 环境变量中配置。本地开发请在 <code className="bg-muted px-1 rounded">.env.local</code> 中设置 <code className="bg-muted px-1 rounded">DEEPSEEK_API_KEY</code> 和 <code className="bg-muted px-1 rounded">SILICONFLOW_API_KEY</code>。</p>
      </CardContent></Card>
    </motion.div>
  </div>;
}
