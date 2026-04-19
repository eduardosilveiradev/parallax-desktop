"use client";

import { Cpu, TerminalWindow, Warning, Trash, Question, Plus, ListDashes, Archive, PuzzlePiece, GitCommit, GitPullRequest, Atom } from "@phosphor-icons/react";
import { useState, useEffect, FormEvent } from "react";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputHeader,
    PromptInputBody,
    PromptInputSelect,
    PromptInputSelectTrigger,
    PromptInputSelectValue,
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
import {
    SessionSelector,
    SessionSelectorContent,
    SessionSelectorEmpty,
    SessionSelectorGroup,
    SessionSelectorInput,
    SessionSelectorItem,
    SessionSelectorList,
    SessionSelectorName,
    SessionSelectorTrigger,
} from "@/components/ai-elements/session-selector";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import Image from "next/image";

type Block =
    | { type: 'user', id: string, text: string }
    | { type: 'assistant', id: string, text: string }
    | { type: 'thinking', id: string, text: string }
    | { type: 'tool-call', id: string, call: { id: string, name: string, args: any, status: 'calling' | 'done', result?: any } };

const API_URL = "http://localhost:3555";

export default function Home() {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [availableModels, setAvailableModels] = useState<{ id: string, label: string, group: string }[]>([]);
    const [selectedModel, setSelectedModel] = useState<{ id: string, label: string, provider: string }>({
        id: 'gemini:gemini-3-flash-preview',
        label: 'Gemini 3 Flash',
        provider: 'google'
    });

    const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
    const [sessionSelectorOpen, setSessionSelectorOpen] = useState(false);
    const [globalCommandOpen, setGlobalCommandOpen] = useState(false);
    const [slashCommandValue, setSlashCommandValue] = useState("");
    const [availableSessions, setAvailableSessions] = useState<{ id: string, mtime: number, messageCount: number }[]>([]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setGlobalCommandOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);


    useEffect(() => {
        async function init() {
            try {
                const ping = await fetch(`${API_URL}/ping`).then(r => r.json());
                setSessionId(ping.sessionId);
                setStatus('connected');

                const hist = await fetch(`${API_URL}/history/${ping.sessionId}`).then(r => r.json());
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

                try {
                    const sessions = await fetch(`${API_URL}/sessions`).then(r => r.json());
                    if (Array.isArray(sessions)) {
                        setAvailableSessions(sessions);
                    }
                } catch (e) {
                    console.error("Failed to fetch sessions", e);
                }

            } catch (e) {
                setStatus('error');
            }
        }
        init();
    }, []);

    const loadSession = async (id: string) => {
        setSessionSelectorOpen(false);
        setSessionId(id);
        const hist = await fetch(`${API_URL}/history/${id}`).then(r => r.json());
        setBlocks(hist.blocks || []);
    };

    const createNewSession = () => {
        setSessionSelectorOpen(false);
        const newId = crypto.randomUUID().substring(0, 8);
        setSessionId(newId);
        setBlocks([]);
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
                body: JSON.stringify({ prompt: sendUserText, sessionId, model: selectedModel.id }),
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
                                    newBlocks[idx] = { ...newBlocks[idx], text: (newBlocks[idx] as any).text + (data.text || '') };
                                } else {
                                    newBlocks.push({ type: 'assistant', id: data.id, text: data.text || '' });
                                }
                            }
                            else if (data.type === 'thinking-delta') {
                                const idx = newBlocks.findIndex(b => b.id === data.id);
                                if (idx >= 0) {
                                    newBlocks[idx] = { ...newBlocks[idx], text: (newBlocks[idx] as any).text + (data.text || '') };
                                } else {
                                    newBlocks.push({ type: 'thinking', id: data.id, text: data.text || '' });
                                }
                            }
                            else if (data.type === 'tool-call') {
                                newBlocks.push({
                                    type: 'tool-call',
                                    id: data.id,
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
        }
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
            <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-3">
                    <Image src="/logo.png" alt="Parallax" width={24} height={24} className="w-5 h-5 text-muted-foreground" />
                    <h1 className="text-sm font-normal">Parallax Desktop</h1>
                </div>
            </header>

            {/* Main Feed using AI Elements */}
            <div className="flex-1 overflow-hidden max-w-3xl w-full mx-auto">
                <Conversation className="h-full">
                    <ConversationContent className="px-6 py-8">
                        {blocks.length === 0 ? (
                            <div className="py-24 text-center text-muted-foreground font-mono text-sm">
                                Session initialized. Awaiting input.
                            </div>
                        ) : (
                            blocks.map((b, idx) => {
                                const isStreamingBlock = streaming && idx === blocks.length - 1;

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
                                    return (
                                        <Message key={b.id} from="assistant">
                                            <MessageContent>
                                                <MessageResponse className="font-sans text-sm text-foreground opacity-90 leading-relaxed pb-6">
                                                    {b.text || <span className="text-destructive">{'<empty response>'}</span>}
                                                </MessageResponse>
                                            </MessageContent>
                                        </Message>
                                    );
                                }

                                if (b.type === 'thinking') {
                                    return (
                                        <Message key={b.id} from="assistant">
                                            <MessageContent>
                                                <Reasoning isStreaming={isStreamingBlock} duration={(b as any).duration}>
                                                    <ReasoningTrigger />
                                                    <ReasoningContent className="font-mono text-sm relative">{b.text}</ReasoningContent>
                                                </Reasoning>
                                            </MessageContent>
                                        </Message>
                                    );
                                }

                                if (b.type === 'tool-call') {
                                    const isDone = b.call.status === 'done';
                                    return (
                                        <Message key={b.id} from="assistant">
                                            <MessageContent>
                                                <Tool>
                                                    <ToolHeader
                                                        type="tool-invocation"
                                                        state={isDone ? "output-available" : "input-available"}
                                                        title={b.call.name.replace(/_/g, ' ')}
                                                    />
                                                    <ToolContent>
                                                        <ToolInput input={b.call.args} />
                                                        {isDone && b.call.result && <ToolOutput output={b.call.result} />}
                                                    </ToolContent>
                                                </Tool>
                                            </MessageContent>
                                        </Message>
                                    );
                                }
                                return null;
                            })
                        )}

                        {streaming && (
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
                            { value: '/load', label: '/load', desc: 'Loads or switches to a historical session memory', action: () => setSessionSelectorOpen(true), icon: <ListDashes weight="duotone" className="w-4 h-4 text-muted-foreground mr-2" /> },
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
                                            { value: '/load', action: () => setSessionSelectorOpen(true) },
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
                                    <ModelSelectorTrigger className="flex items-center gap-2 px-3 py-1.5 border border-border/40 hover:bg-white/5 rounded-md transition-colors cursor-pointer outline-none max-w-[200px]">
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
                                <SessionSelector open={sessionSelectorOpen} onOpenChange={setSessionSelectorOpen}>
                                    <SessionSelectorTrigger className="flex items-center gap-2 px-3 py-1.5 border border-border/40 hover:bg-white/5 rounded-md transition-colors cursor-pointer outline-none">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <SessionSelectorName>{sessionId || "..."}</SessionSelectorName>
                                    </SessionSelectorTrigger>
                                    <SessionSelectorContent title="Select Session" className="sm:max-w-106.25">
                                        <SessionSelectorInput placeholder="Search sessions..." />
                                        <SessionSelectorList>
                                            <SessionSelectorEmpty>No sessions found.</SessionSelectorEmpty>
                                            <SessionSelectorGroup heading="Actions">
                                                <SessionSelectorItem onSelect={createNewSession}>
                                                    <span className="font-medium">Create New Session</span>
                                                </SessionSelectorItem>
                                            </SessionSelectorGroup>
                                            <SessionSelectorGroup heading="Sessions">
                                                {availableSessions.map(session => (
                                                    <SessionSelectorItem key={session.id} onSelect={() => loadSession(session.id)}>
                                                        <div className="flex flex-col w-full text-left gap-1 my-1">
                                                            <span className="font-medium text-sm text-foreground flex items-center justify-between">
                                                                {session.id}
                                                                {session.id === sessionId && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground flex justify-between">
                                                                <span>{new Date(session.mtime).toLocaleTimeString()}</span>
                                                                <span>{session.messageCount} msgs</span>
                                                            </span>
                                                        </div>
                                                    </SessionSelectorItem>
                                                ))}
                                            </SessionSelectorGroup>
                                        </SessionSelectorList>
                                    </SessionSelectorContent>
                                </SessionSelector>
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
                            setSessionSelectorOpen(true);
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
