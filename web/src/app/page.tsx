"use client";

import { Cpu, TerminalWindow, Warning, Shield, Trash, Question, Plus, ListDashes, Archive, PuzzlePiece, GitCommit, GitPullRequest, Atom, Minus, Square, X, Copy, SidebarSimple, ChatTeardrop, CaretDown, CaretRight, SpinnerGap, SpinnerIcon } from "@phosphor-icons/react";
import { useState, useEffect, FormEvent, useMemo } from "react";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputBody,
    PromptInputTools,
    PromptInputCommand,
    PromptInputCommandList,
    PromptInputCommandGroup,
    PromptInputCommandItem,
    PromptInputCommandEmpty
} from "@/components/ai-elements/prompt-input";
import {
    ModelSelector,
    ModelSelectorContent,
    ModelSelectorEmpty,
    ModelSelectorInput,
    ModelSelectorItem,
    ModelSelectorList,
    ModelSelectorLogo,
    ModelSelectorName,
    ModelSelectorTrigger,
    ModelSelectorGroup,
} from "@/components/ai-elements/model-selector";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { DiffViewer } from "@/components/ai-elements/diff-viewer";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import Image from "next/image";

type Block =
    | { type: 'user', id: string, text: string }
    | { type: 'assistant', id: string, text: string }
    | { type: 'thinking', id: string, text: string }
    | { type: 'tool-call', id: string, awaitConfirm?: boolean, call: { id: string, name: string, args: any, status: 'calling' | 'done', result?: any } };

const API_URL = "http://localhost:3555";

function ControlledTool({ b, isDone, children }: { b: any, isDone: boolean, children: React.ReactNode }) {
    const isAwaiting = !isDone && !!b.awaitConfirm;
    const [open, setOpen] = useState(isAwaiting);

    useEffect(() => {
        setOpen(isAwaiting);
    }, [isAwaiting]);

    return (
        <Tool open={open} onOpenChange={setOpen}>
            {children}
        </Tool>
    );
}

function WorkGroup({ group, streaming, isLast, onApprove, onReject }: { group: any, streaming: boolean, isLast: boolean, onApprove: (id: string, callId: string) => void, onReject: (id: string, callId: string) => void }) {
    const [open, setOpen] = useState(!group.isDone);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (group.isDone) {
            setSeconds(group.duration);
            setOpen(false);
            return;
        }

        setOpen(true);
        const internalStart = Date.now();
        const interval = setInterval(() => {
            setSeconds((Date.now() - internalStart) / 1000);
        }, 100);

        return () => clearInterval(interval);
    }, [group.isDone, group.duration]);

    return (
        <Message from="assistant">
            <MessageContent>
                <Collapsible open={open} onOpenChange={setOpen} className="mb-6 mt-2 rounded-lg border border-border/30 bg-card/30 overflow-hidden">
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors focus:outline-none">
                        <div className="flex items-center gap-3 text-sm font-medium opacity-80">
                            {!group.isDone ? (
                                <SpinnerIcon weight="bold" className="w-4 h-4 text-primary animate-spin" />
                            ) : (
                                <Atom weight="duotone" className="w-4 h-4 text-muted-foreground" />
                            )}
                            {group.isDone ? <span className="text-sm font-medium opacity-80">
                                {`Worked for ${seconds.toFixed(1)}s`}
                            </span> : <Shimmer>
                                {`Working... ${seconds.toFixed(1)}s`}
                            </Shimmer>}
                        </div>
                        <div className="text-muted-foreground">
                            {open ? <CaretDown weight="bold" className="w-4 h-4" /> : <CaretRight weight="bold" className="w-4 h-4" />}
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-5 pb-5 pt-1">
                        <div className="flex flex-col gap-5 border-l-2 border-border/20 pl-4 py-1 max-w-full overflow-hidden mt-1">
                            {group.blocks.map((b: any, idx: number) => {
                                const isStreamingBlock = streaming && isLast && idx === group.blocks.length - 1;

                                if (b.type === 'thinking') {
                                    return (
                                        <div key={b.id} className="relative w-full max-w-full overflow-hidden">
                                            <Reasoning isStreaming={isStreamingBlock} duration={b.duration}>
                                                <ReasoningTrigger />
                                                <ReasoningContent className="font-mono text-sm relative">{b.text}</ReasoningContent>
                                            </Reasoning>
                                        </div>
                                    );
                                }

                                if (b.type === 'tool-call') {
                                    const isDone = b.call.status === 'done';
                                    const lowerName = b.call.name.toLowerCase();
                                    const showDiff = ['replacefilecontent', 'multireplacefilecontent', 'replace_file_content', 'multi_replace_file_content'].includes(lowerName);

                                    return (
                                        <div key={b.id} className="relative w-full max-w-full overflow-hidden mt-2 first:mt-0">
                                            <ControlledTool b={b} isDone={isDone}>
                                                <ToolHeader
                                                    type="tool-invocation"
                                                    state={isDone ? "output-available" : (!isDone && b.awaitConfirm ? "approval-requested" : "input-available")}
                                                    title={b.call.name.replace(/_/g, ' ')}
                                                    args={b.call.args}
                                                    result={b.call.result}
                                                />
                                                <ToolContent>
                                                    <ToolInput input={b.call.args} name={b.call.name.replace(/_/g, '')} />

                                                    {showDiff && (
                                                        <DiffViewer
                                                            targetFile={b.call.args.TargetFile}
                                                            targetContent={b.call.args.TargetContent}
                                                            replacementContent={b.call.args.ReplacementContent}
                                                            patch={b.call.result?.diff}
                                                        />
                                                    )}

                                                    {!isDone && b.awaitConfirm && (
                                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                                                            <button
                                                                onClick={() => onApprove(b.id, b.call.id)}
                                                                className="px-3 py-1.5 text-xs font-medium rounded bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors"
                                                            >
                                                                Approve & Run
                                                            </button>
                                                            <button
                                                                onClick={() => onReject(b.id, b.call.id)}
                                                                className="px-3 py-1.5 text-xs font-medium rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}

                                                    {isDone && b.call.result && <ToolOutput output={b.call.result} errorText={b.call.result.error || ""} name={b.call.name.replace(/_/g, '')} />}
                                                </ToolContent>
                                            </ControlledTool>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </MessageContent>
        </Message>
    );
}

export default function Home() {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [availableModels, setAvailableModels] = useState<{ id: string, label: string, provider: string, group: string }[]>([]);
    const [selectedModel, setSelectedModel] = useState<{ id: string, label: string, provider: string }>({
        id: 'gemini:gemini-3-flash-preview',
        label: 'Gemini 3 Flash',
        provider: 'google'
    });

    const [yoloMode, setYoloMode] = useState(false);
    const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
    const [globalCommandOpen, setGlobalCommandOpen] = useState(false);
    const [slashCommandValue, setSlashCommandValue] = useState("");
    const [availableSessions, setAvailableSessions] = useState<{ id: string, mtime: number, messageCount: number, lastMessage?: string }[]>([]);
    const [isMaximized, setIsMaximized] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.onMaximizeChange) {
            (window as any).electronAPI.onMaximizeChange((maximized: boolean) => {
                setIsMaximized(maximized);
            });
        }

        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setGlobalCommandOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const refreshSessions = async () => {
        try {
            const sessions = await fetch(`${API_URL}/sessions`).then(r => r.json());
            if (Array.isArray(sessions)) setAvailableSessions(sessions);
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        }
    };

    useEffect(() => {
        async function init() {
            try {
                const params = new URLSearchParams(window.location.search);
                const urlSession = params.get('session');
                const ping = await fetch(`${API_URL}/ping`).then(r => r.json());

                const initialSessionId = urlSession || ping.sessionId;
                setSessionId(initialSessionId);
                setStatus('connected');

                if (typeof window !== 'undefined') {
                    window.history.replaceState(null, '', `?session=${initialSessionId}`);
                }

                const hist = await fetch(`${API_URL}/history/${initialSessionId}`).then(r => r.json());
                if (hist.blocks) {
                    setBlocks(hist.blocks);
                }

                try {
                    const models = await fetch(`${API_URL}/models`).then(r => r.json());
                    if (Array.isArray(models)) {
                        setAvailableModels(models);
                        if (models.length > 0 && !models.find(m => m.id === selectedModel.id)) {
                            const first = models[0];
                            setSelectedModel({ id: first.id, label: first.label, provider: first.id.split(':')[0] });
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch models", e);
                }

                await refreshSessions();

            } catch (e) {
                setStatus('error');
            }
        }
        init();
    }, []);

    const loadSession = async (id: string) => {
        setSessionId(id);
        const hist = await fetch(`${API_URL}/history/${id}`).then(r => r.json());
        setBlocks(hist.blocks || []);
        if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `?session=${id}`);
        }
    };

    const createNewSession = async () => {
        const newId = crypto.randomUUID().substring(0, 8);
        setSessionId(newId);
        setBlocks([]);
        if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `?session=${newId}`);
        }
        await refreshSessions();
    };

    const deleteSession = async (id: string) => {
        setAvailableSessions(prev => prev.filter(s => s.id !== id));
        try {
            await fetch(`${API_URL}/sessions/${id}`, { method: 'DELETE' });
            if (sessionId === id) {
                createNewSession();
            }
            await refreshSessions();
        } catch (e) {
            console.error("Failed to delete session", e);
        }
    };

    const stopGeneration = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
        }
        setStreaming(false);
    };

    const onSubmit = async (overridePrompt?: string) => {
        const prompt = (overridePrompt || input).trim();
        if (!prompt || !sessionId || streaming) return;

        const cmd = prompt.split(' ')[0].toLowerCase();
        if (cmd === '/clear' || cmd === '/new') {
            setInput("");
            createNewSession();
            return;
        }

        let displayUserText = prompt;
        let sendUserText = prompt;

        if (cmd === '/help') {
            sendUserText = "List available capabilities and skills you have in this workspace";
        } else if (cmd === '/init') {
            sendUserText = "CRITICAL INSTRUCTION: Analyze the entire codebase in the current directory. Generate a 70-120 line comprehensive description of the codebase including architectural details, and write it to 'PARALLAX.md'. This file will be used as the agent's system prompt on subsequent initializations.";
        } else if (cmd === '/compact') {
            sendUserText = "CRITICAL INSTRUCTION: Provide an in-depth, highly comprehensive summary of our ENTIRE conversation history up to this point. Include all relevant technical context, code paths, goals, and decisions. This summary will be used to replace our entire context window to save tokens, so ensure no critical information is lost.";
        } else if (cmd.startsWith('/commit')) {
            if (cmd === '/commit:pr') {
                sendUserText = "CRITICAL INSTRUCTION: Analyze the changes made in this session. Generate a commit message and commit them locally. To open a PR, check if the user has push access to origin. If they do not, use the GitHub CLI to autonomously fork the repository and push to the fork instead. Finally, use `gh pr create --fill` to submit the Pull Request. Ensure all `gh` commands are run non-interactively to prevent terminal hanging.";
            } else if (cmd === '/commit:no-push') {
                sendUserText = "CRITICAL INSTRUCTION: Analyze the changes made in this session. Generate a commit message for the current changes and commit them locally. Do NOT push to origin.";
            } else {
                sendUserText = "CRITICAL INSTRUCTION: Analyze the changes made in this session. Generate a commit message for the current changes. Afterwards commit with that message and push to origin.";
            }
        } else if (cmd === '/parallax') {
            const objective = prompt.slice(9).trim();
            displayUserText = `/parallax ${objective}`;
            sendUserText = `CRITICAL INSTRUCTION: You are the Master Coordinator Agent. Your objective is: "${objective}".\nYou MUST NOT perform simple implementations directly. Instead, break this objective down into smaller tasks and use your \`subagent\` tool to spawn smaller execution agents to perform each sub-task. You MUST spawn all independent subagents concurrently in a SINGLE turn using parallel tool calls. Do not wait for one to finish before starting another unless they have strict dependencies. Coordinate their results and compile the complete solution.`;
            setSelectedModel({ id: 'gemini:gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'google' });
        } else if (cmd === '/skills' || cmd === '/skills-install') {
            sendUserText = `CRITICAL INSTRUCTION: List the available skills and ask me which one to install using the skill command.`;
        }

        setInput("");
        setStreaming(true);

        const controller = new AbortController();
        setAbortController(controller);

        const userBlockId = crypto.randomUUID();
        setBlocks(prev => [...prev, { type: 'user', id: userBlockId, text: displayUserText }]);

        try {
            const res = await fetch(`${API_URL}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: sendUserText, sessionId, model: selectedModel.id, yolo: yoloMode }),
                signal: controller.signal
            });

            if (!res.ok || !res.body) throw new Error("Stream failed");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                const events: any[] = [];
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6).trim();
                        if (!dataStr) continue;

                        try {
                            events.push(JSON.parse(dataStr));
                        } catch (err) {
                            console.warn("Dropped malformed SSE chunk:", dataStr);
                        }
                    }
                }

                if (events.length > 0) {
                    console.log("Processing batch of SSE events:", events);
                    setBlocks(prev => {
                        const newBlocks = [...prev];

                        for (const data of events) {
                            if (data.type === 'text-delta') {
                                const idx = newBlocks.findIndex(b => b.id === data.id);
                                if (idx >= 0) {
                                    const b = newBlocks[idx];
                                    if (b.type === 'assistant') {
                                        newBlocks[idx] = { ...b, text: b.text + (data.text || '') };
                                    }
                                } else {
                                    newBlocks.push({ type: 'assistant', id: data.id, text: data.text || '' });
                                }
                            }
                            else if (data.type === 'thinking-delta') {
                                const idx = newBlocks.findIndex(b => b.id === data.id);
                                if (idx >= 0) {
                                    const b = newBlocks[idx];
                                    if (b.type === 'thinking') {
                                        newBlocks[idx] = { ...b, text: b.text + (data.text || '') };
                                    }
                                } else {
                                    newBlocks.push({ type: 'thinking', id: data.id, text: data.text || '' });
                                }
                            }
                            else if (data.type === 'tool-call') {
                                newBlocks.push({
                                    type: 'tool-call',
                                    id: data.id,
                                    awaitConfirm: data.awaitConfirm,
                                    call: { id: data.id, name: data.name, args: data.input, status: 'calling' }
                                });
                            }
                            else if (data.type === 'tool-result') {
                                const idx = newBlocks.findIndex(b => b.type === 'tool-call' && (b as any).call.id === data.id);
                                if (idx >= 0) {
                                    const callBlock = newBlocks[idx] as any;
                                    newBlocks[idx] = { ...callBlock, call: { ...callBlock.call, status: 'done', result: data.output } };
                                }
                            }
                        }

                        console.log("New blocks state:", newBlocks);
                        return newBlocks;
                    });
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Stream aborted by user');
            } else {
                console.error(err);
            }
        } finally {
            setStreaming(false);
            setAbortController(null);
            refreshSessions();
        }
    };

    const groupedBlocks = useMemo(() => {
        const groups: ({ type: 'single', block: Block } | { type: 'work', id: string, blocks: Block[], isDone: boolean, duration: number })[] = [];
        let currentWorkGroup: { type: 'work', id: string, blocks: Block[], duration: number } | null = null;

        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.type === 'thinking' || b.type === 'tool-call') {
                if (!currentWorkGroup) {
                    currentWorkGroup = { type: 'work', id: `work-${b.id}`, blocks: [], duration: 0 };
                }
                currentWorkGroup.blocks.push(b);
                if (b.type === 'thinking' && (b as any).duration) {
                    currentWorkGroup.duration += (b as any).duration;
                }
            } else {
                if (currentWorkGroup) {
                    groups.push({ ...currentWorkGroup, isDone: true });
                    currentWorkGroup = null;
                }
                groups.push({ type: 'single', block: b });
            }
        }

        if (currentWorkGroup) {
            groups.push({ ...currentWorkGroup, isDone: !streaming });
        }

        return groups;
    }, [blocks, streaming]);

    const handleApprove = (blockId: string, callId: string) => {
        setBlocks(prev => {
            const next = [...prev];
            const blockIdx = next.findIndex(x => x.id === blockId);
            if (blockIdx >= 0) {
                next[blockIdx] = { ...next[blockIdx], awaitConfirm: false } as any;
            }
            return next;
        });
        fetch(`${API_URL}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolCallId: callId, approve: true })
        });
    };

    const handleReject = (blockId: string, callId: string) => {
        setBlocks(prev => {
            const next = [...prev];
            const blockIdx = next.findIndex(x => x.id === blockId);
            if (blockIdx >= 0) {
                next[blockIdx] = { ...next[blockIdx], awaitConfirm: false } as any;
            }
            return next;
        });
        fetch(`${API_URL}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolCallId: callId, approve: false })
        });
    };


    if (status === 'connecting') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
                <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
                    <Cpu weight="duotone" className="w-12 h-12" />
                    <Shimmer>Connecting to CLI Daemon...</Shimmer>
                </div>
            </main>
        );
    }

    if (status === 'error') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
                <div className="flex flex-col items-center gap-4 text-destructive">
                    <Warning weight="duotone" className="w-12 h-12" />
                    <p className="text-sm mb-4">Daemon Unreachable</p>
                    <div className="bg-destructive/10 text-destructive p-4 border border-destructive/20 rounded-md text-sm text-center max-w-md">
                        Parallax Desktop relies on parallax-cli running via <code className="font-mono bg-black/50 px-1 py-0.5 rounded">pnpm serve</code> on your machine. The internal RPC server on port 3555 is offline.
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col bg-background text-foreground h-screen overflow-hidden">
            {/* Header */}
            <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md relative z-10 [-webkit-app-region:drag]">
                <div className="flex items-center gap-4">
                    <button
                        className="[-webkit-app-region:no-drag] text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <SidebarSimple weight="bold" className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <Image loading="lazy" src="/logo.png" alt="Parallax" width={24} height={24} className="w-5 h-5 text-muted-foreground" />
                        <h1 className="text-sm font-normal">Parallax Desktop</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3 [-webkit-app-region:no-drag]">
                    <button
                        onClick={() => (window as any).electronAPI?.windowMinimize()}
                        className="text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors p-1.5 rounded-md focus:outline-none"
                    >
                        <Minus weight="bold" className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => (window as any).electronAPI?.windowToggleMaximize()}
                        className="text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors p-1.5 rounded-md focus:outline-none"
                    >
                        {isMaximized ? (
                            <Copy weight="bold" className="w-4 h-4" />
                        ) : (
                            <Square weight="bold" className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        onClick={() => (window as any).electronAPI?.windowClose()}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-1.5 rounded-md focus:outline-none"
                    >
                        <X weight="bold" className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                {sidebarOpen && (
                    <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-card/10 flex flex-col hide-scrollbar">
                        <div className="p-4 border-b border-border/50">
                            <button
                                onClick={createNewSession}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                            >
                                <span>New Session</span>
                                <Plus weight="bold" className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-2 flex-1 flex flex-col gap-1">
                            {availableSessions.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-muted-foreground text-center">No recent sessions</div>
                            ) : (
                                availableSessions.map((session) => (
                                    <div
                                        key={session.id}
                                        className={`group flex items-start justify-between px-3 py-3 rounded-md cursor-pointer transition-colors ${sessionId === session.id
                                            ? "bg-white/10"
                                            : "hover:bg-white/5"
                                            }`}
                                        onClick={() => loadSession(session.id)}
                                    >
                                        <div className="flex flex-col gap-1 truncate w-full pr-2">
                                            <div className="flex items-center gap-2">
                                                <ChatTeardrop weight={sessionId === session.id ? "fill" : "regular"} className={`w-3.5 h-3.5 shrink-0 ${sessionId === session.id ? "text-foreground" : "text-muted-foreground"}`} />
                                                <span className={`truncate text-sm ${sessionId === session.id ? "text-foreground font-medium" : "text-muted-foreground"}`}>{session.id}</span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground/70 pl-5.5 truncate font-sans italic">
                                                {session.lastMessage || 'Empty session...'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 pl-5.5 font-mono mt-0.5">
                                                <span>{new Date(session.mtime).toLocaleDateString()}</span>
                                                <span>&middot;</span>
                                                <span>{session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(session.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all focus:outline-none p-1.5 -mr-1 mt-0.5 rounded"
                                            title="Delete Session"
                                        >
                                            <Trash weight="fill" className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Main Feed using AI Elements */}
                    <div className="flex-1 overflow-hidden max-w-3xl w-full mx-auto">
                        <Conversation className="h-full">
                            <ConversationContent className="px-6 py-8 gap-1">
                                {blocks.length === 0 ? (
                                    <div className="py-24 text-center text-muted-foreground font-mono text-sm">
                                        Session initialized. Awaiting input.
                                    </div>
                                ) : (
                                    groupedBlocks.map((group, groupIdx) => {
                                        const isLast = groupIdx === groupedBlocks.length - 1;

                                        if (group.type === 'single') {
                                            const b = group.block;
                                            if (b.type === 'user') {
                                                return (
                                                    <Message key={b.id} from="user">
                                                        <MessageContent className="whitespace-pre-wrap font-sans text-sm pb-8">
                                                            {b.text}
                                                        </MessageContent>
                                                    </Message>
                                                );
                                            }

                                            if (b.type === 'assistant') {
                                                const isStreamingBlock = streaming && isLast && groupIdx === groupedBlocks.length - 1;
                                                return (
                                                    <Message key={b.id} from="assistant">
                                                        <MessageContent>
                                                            <MessageResponse className="font-sans text-sm text-foreground opacity-90 leading-relaxed pb-6">
                                                                {b.text || (isStreamingBlock ? '' : '<empty response>')}
                                                            </MessageResponse>
                                                        </MessageContent>
                                                    </Message>
                                                );
                                            }
                                        }

                                        if (group.type === 'work') {
                                            return (
                                                <WorkGroup
                                                    key={group.id}
                                                    group={group}
                                                    streaming={streaming}
                                                    isLast={isLast}
                                                    onApprove={handleApprove}
                                                    onReject={handleReject}
                                                />
                                            );
                                        }

                                        return null;
                                    })
                                )}

                                {streaming && (groupedBlocks.length === 0 || (groupedBlocks[groupedBlocks.length - 1].type === 'single' && groupedBlocks[groupedBlocks.length - 1].block.type === 'user')) && (
                                    <Message from="assistant">
                                        <MessageContent>
                                            <Shimmer>Working...</Shimmer>
                                        </MessageContent>
                                    </Message>
                                )}
                            </ConversationContent>
                        </Conversation>
                    </div>

                    {/* Input */}
                    <div className="shrink-0 p-6 bg-card/30 border-t border-border backdrop-blur-md relative z-10 w-full">
                        <div className="max-w-3xl mx-auto relative group">
                            {(() => {
                                const showSlashMenu = input.startsWith('/');
                                const slashCommands = [
                                    { value: '/model', label: '/model', desc: 'Change the current model', action: () => setModelSelectorOpen(true), icon: <Cpu weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/new', label: '/new (or /clear)', desc: 'Starts a brand new session and clears the screen', action: createNewSession, icon: <Trash weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/init', label: '/init', desc: 'Analyze codebase and create PARALLAX.md', action: () => onSubmit('/init'), icon: <TerminalWindow weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/compact', label: '/compact', desc: 'Summarize and compress conversation history to save tokens', action: () => onSubmit('/compact'), icon: <Archive weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/load', label: '/load', desc: 'Loads or switches to a historical session memory', action: () => setSidebarOpen(true), icon: <ListDashes weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/skills', label: '/skills', desc: 'Install new agent skills from skills.sh locally or globally', action: () => onSubmit('/skills'), icon: <PuzzlePiece weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/commit', label: '/commit', desc: 'Creates a commit with the current changes, then pushes', action: () => onSubmit('/commit'), icon: <GitCommit weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/commit:pr', label: '/commit:pr', desc: 'Creates a commit, pushes, and uses the GitHub CLI to open a pull request', action: () => onSubmit('/commit:pr'), icon: <GitPullRequest weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/commit:no-push', label: '/commit:no-push', desc: 'Creates a commit with the current changes without pushing', action: () => onSubmit('/commit:no-push'), icon: <GitCommit weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/parallax', label: '/parallax', desc: 'Spawns a Master Coordinator Agent to orchestrate subagents for a large task', action: () => onSubmit('/parallax'), icon: <Atom weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
                                    { value: '/help', label: '/help', desc: 'Show available capabilities', action: () => onSubmit("/help"), icon: <Question weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> }
                                ];
                                const filtered = slashCommands.filter(c => c.value.startsWith(input.trim().toLowerCase()));

                                return showSlashMenu && (
                                    <div className="absolute bottom-[calc(100%+8px)] left-0 w-[400px] rounded-lg border border-border/60 bg-popover/90 backdrop-blur-md shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 fade-in z-50">
                                        <PromptInputCommand
                                            className="bg-transparent border-none outline-none"
                                            value={slashCommandValue}
                                            onValueChange={setSlashCommandValue}
                                        >
                                            <PromptInputCommandList>
                                                {filtered.length === 0 && (
                                                    <PromptInputCommandEmpty className="py-6 text-center text-sm text-muted-foreground">No command found.</PromptInputCommandEmpty>
                                                )}
                                                {filtered.length > 0 && (
                                                    <PromptInputCommandGroup heading="Slash Commands">
                                                        {filtered.map(cmd => (
                                                            <PromptInputCommandItem
                                                                key={cmd.value}
                                                                value={cmd.value}
                                                                onSelect={() => {
                                                                    setInput("");
                                                                    cmd.action();
                                                                }}
                                                                className="flex items-center cursor-pointer py-2 px-3"
                                                            >
                                                                {cmd.icon}
                                                                <span className="font-medium mr-2">{cmd.label}</span>
                                                                <span className="text-muted-foreground text-xs">{cmd.desc}</span>
                                                            </PromptInputCommandItem>
                                                        ))}
                                                    </PromptInputCommandGroup>
                                                )}
                                            </PromptInputCommandList>
                                        </PromptInputCommand>
                                    </div>
                                );
                            })()}
                            <PromptInput onSubmit={({ text }) => { if (!streaming) { setInput(text); onSubmit(text); } }}>
                                <PromptInputBody className="relative">
                                    <PromptInputTextarea
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (input.startsWith('/')) {
                                                const slashCommands = [
                                                    { value: '/model', action: () => setModelSelectorOpen(true) },
                                                    { value: '/new', action: createNewSession },
                                                    { value: '/clear', action: createNewSession },
                                                    { value: '/init', action: () => onSubmit('/init') },
                                                    { value: '/compact', action: () => onSubmit('/compact') },
                                                    { value: '/load', action: () => setSidebarOpen(true) },
                                                    { value: '/skills', action: () => onSubmit('/skills') },
                                                    { value: '/commit', action: () => onSubmit('/commit') },
                                                    { value: '/commit:pr', action: () => onSubmit('/commit:pr') },
                                                    { value: '/commit:no-push', action: () => onSubmit('/commit:no-push') },
                                                    { value: '/parallax', action: () => onSubmit(input) }, // pass full input for parallax args
                                                    { value: '/help', action: () => onSubmit('/help') }
                                                ];
                                                const filtered = slashCommands.filter(c => c.value.startsWith(input.trim().toLowerCase()));

                                                if (filtered.length > 0) {
                                                    const currentIndex = filtered.findIndex(c => c.value === slashCommandValue);

                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        const nextIdx = currentIndex === -1 ? 0 : (currentIndex + 1) % filtered.length;
                                                        setSlashCommandValue(filtered[nextIdx].value);
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        const nextIdx = currentIndex === -1 ? filtered.length - 1 : (currentIndex - 1 + filtered.length) % filtered.length;
                                                        setSlashCommandValue(filtered[nextIdx].value);
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const selected = filtered.find(c => c.value === slashCommandValue) || filtered[0];
                                                        if (selected) {
                                                            setInput("");
                                                            selected.action();
                                                        }
                                                    }
                                                }
                                            }
                                        }}
                                        disabled={streaming}
                                        placeholder="Command Parallax..."
                                    />
                                </PromptInputBody>
                                <PromptInputFooter>
                                    <PromptInputTools>
                                        <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                                            <ModelSelectorTrigger className="flex items-center gap-2 px-3 py-1.5 border border-border/40 hover:bg-white/5 rounded-md transition-colors cursor-pointer outline-none max-w-50">
                                                <ModelSelectorLogo provider={selectedModel.provider} />
                                                <ModelSelectorName>{selectedModel.label}</ModelSelectorName>
                                            </ModelSelectorTrigger>
                                            <ModelSelectorContent title="Select Model" className="sm:max-w-106.25">
                                                <ModelSelectorInput placeholder="Search models..." />
                                                <ModelSelectorList>
                                                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                                                    {Object.entries(
                                                        availableModels.reduce((acc, m) => {
                                                            if (!acc[m.group]) acc[m.group] = [];
                                                            acc[m.group].push(m);
                                                            return acc;
                                                        }, {} as Record<string, typeof availableModels>)
                                                    ).map(([group, models]) => (
                                                        <ModelSelectorGroup key={group} heading={group}>
                                                            {models.map(m => {
                                                                const providerName = m.id.split(':')[0];
                                                                return (
                                                                    <ModelSelectorItem
                                                                        key={m.id}
                                                                        onSelect={() => {
                                                                            setSelectedModel({ id: m.id, label: m.label, provider: providerName });
                                                                            setModelSelectorOpen(false);
                                                                        }}
                                                                    >
                                                                        <ModelSelectorLogo provider={providerName} className="mr-2" />
                                                                        {m.label}
                                                                    </ModelSelectorItem>
                                                                )
                                                            })}
                                                        </ModelSelectorGroup>
                                                    ))}
                                                </ModelSelectorList>
                                            </ModelSelectorContent>
                                        </ModelSelector>
                                        <button
                                            onClick={() => setYoloMode(v => !v)}
                                            title={yoloMode ? "YOLO Mode Active: Agent will auto-execute any tools" : "Safe Mode Active: You must confirm tool executions"}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase border hover:bg-white/5 rounded-md transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-ring ${yoloMode ? 'border-destructive/50 text-destructive bg-destructive/5' : 'border-border/40 text-muted-foreground'}`}
                                        >
                                            <span className="opacity-70">{yoloMode ? <Warning weight="bold" className="w-3.5 h-3.5" /> : <Shield weight="bold" className="w-3.5 h-3.5 shrink-0" />}</span>
                                            <span>YOLO</span>
                                        </button>
                                    </PromptInputTools>
                                    <PromptInputSubmit
                                        disabled={streaming ? false : !input.trim()}
                                        status={streaming ? "streaming" : "ready"}
                                        onStop={stopGeneration}
                                        onClick={e => {
                                            if (streaming) e.preventDefault();
                                            // allow standard submission
                                        }}
                                    />
                                </PromptInputFooter>
                            </PromptInput>
                        </div>
                    </div>
                </div>
            </div>

            <CommandDialog open={globalCommandOpen} onOpenChange={setGlobalCommandOpen}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Actions">
                        <CommandItem onSelect={() => {
                            setGlobalCommandOpen(false);
                            createNewSession();
                        }} className="cursor-pointer py-3">
                            <Plus weight="bold" className="mr-2 h-4 w-4" />
                            <span>New Chat</span>
                        </CommandItem>
                        <CommandItem onSelect={() => {
                            setGlobalCommandOpen(false);
                            setSidebarOpen(true);
                        }} className="cursor-pointer py-3">
                            <ListDashes weight="bold" className="mr-2 h-4 w-4" />
                            <span>Switch Session</span>
                        </CommandItem>
                        <CommandItem onSelect={() => {
                            setGlobalCommandOpen(false);
                            setModelSelectorOpen(true);
                        }} className="cursor-pointer py-3">
                            <Cpu weight="bold" className="mr-2 h-4 w-4" />
                            <span>Select Model</span>
                        </CommandItem>
                        <CommandItem onSelect={() => {
                            setGlobalCommandOpen(false);
                            onSubmit("List available capabilities and skills you have in this workspace");
                        }} className="cursor-pointer py-3">
                            <Question weight="bold" className="mr-2 h-4 w-4" />
                            <span>Help</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </main>
    );
}
