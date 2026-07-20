// ============================================================================
// 功能模块元信息
// 这里只放纯配置，避免设置状态依赖具体模块组件造成循环引用。
// ============================================================================

import {
  BrainCircuit,
  Cpu,
  Database,
  FileBox,
  Flame,
  HardDrive,
  Layers,
  MessageCircle,
  MousePointerClick,
  Package,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type LayoutMode = 'cards' | 'pages' | 'split';

export type AppModuleId =
  | 'junk-clean'
  | 'big-files'
  | 'social-clean'
  | 'system-slim'
  | 'driver-cleanup'
  | 'bloatware-clean'
  | 'leftovers'
  | 'registry'
  | 'context-menu'
  | 'hotspot'
  | 'disk-growth'
  | 'ai-models';

export interface AppModuleMeta {
  /** 模块在页面和导航里的稳定 ID，必须和 data-module-id 保持一致。 */
  id: AppModuleId;
  label: string;
  /** 一句话说明模块用途，供顶部引导条展示 */
  summary: string;
  icon: ComponentType<{ className?: string }>;
}

export const APP_MODULE_META: AppModuleMeta[] = [
  { id: 'junk-clean', label: '垃圾清理', summary: '扫描并清理临时文件、浏览器缓存、回收站等常见系统垃圾。', icon: Trash2 },
  { id: 'big-files', label: '大文件清理', summary: '找出占用空间最大的文件，管理员下可优先使用 MFT 快速扫描。', icon: FileBox },
  { id: 'social-clean', label: '社交软件专清', summary: '清理微信、QQ、钉钉等缓存目录，不影响聊天记录与账号数据。', icon: MessageCircle },
  { id: 'system-slim', label: '系统瘦身', summary: '关闭休眠、分析 WinSxS 可回收组件等系统级瘦身（需管理员权限）。', icon: Layers },
  { id: 'driver-cleanup', label: '旧驱动清理', summary: '通过 pnputil 检测第三方旧驱动包，删除前自动备份（需管理员权限）。', icon: Cpu },
  { id: 'bloatware-clean', label: '垃圾软件清理', summary: '识别 360、鲁大师等常见捆绑软件，调用官方卸载程序（建议管理员权限）。', icon: ShieldOff },
  { id: 'leftovers', label: '卸载残留', summary: '深度检索 AppData、ProgramData 等位置，识别卸载后遗留的软件目录。', icon: Package },
  { id: 'registry', label: '注册表冗余', summary: '清理已卸载程序在注册表中遗留、且目标文件已不存在的关联引用。', icon: Database },
  { id: 'context-menu', label: '右键菜单清理', summary: '扫描并整理资源管理器右键菜单中的冗余项，减少菜单过长问题。', icon: MousePointerClick },
  { id: 'hotspot', label: '大目录分析', summary: '分析磁盘上占用最大的目录，快速定位空间热点与可清理目标。', icon: Flame },
  { id: 'disk-growth', label: '磁盘变化分析', summary: '对比两次快照，找出近期增长最快的目录与文件变化。', icon: HardDrive },
  { id: 'ai-models', label: 'AI 模型空间', summary: '统计本地 AI 模型、LoRA 与缓存占用，支持打开目录与按需删除。', icon: BrainCircuit },
];

export const DEFAULT_ACTIVE_MODULE_ID: AppModuleId = 'junk-clean';

/** 按模块 ID 查找元信息，供顶部引导条等壳层组件使用 */
export function getModuleMeta(moduleId: AppModuleId): AppModuleMeta | undefined {
  return APP_MODULE_META.find((module) => module.id === moduleId);
}
