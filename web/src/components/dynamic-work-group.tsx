"use client";

import { useEffect, useState } from "react";
import { Message, MessageContent } from "./ai-elements/message";
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader } from "./ai-elements/chain-of-thought";
import { Shimmer } from "./ai-elements/shimmer";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./ai-elements/reasoning";
import { Atom, ClockIcon } from "@phosphor-icons/react";
import { getToolLabel, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, ToolIcon } from "./ai-elements/tool";
import { DiffViewer } from "./ai-elements/diff-viewer";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

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

export function WorkGroup({ group, streaming, isLast, onApprove, onReject, onSubmit }: { group: any, streaming: boolean, isLast: boolean, onApprove: (id: string, callId: string) => void, onReject: (id: string, callId: string) => void, onSubmit: (text: string) => void }) {
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

    const lastBlock = group.blocks[group.blocks.length - 1];
    const statusLabel = lastBlock?.type === "tool-call" ? getToolLabel(lastBlock?.call?.name || "", lastBlock?.call?.args, lastBlock?.call?.status || "calling", lastBlock?.call?.result) : "Thinking";

    return (
        <Message from="assistant" className="w-full max-w-none">
            <MessageContent className="w-full max-w-none">
                <ChainOfThought open={true} className="mb-6 mt-2">
                    <ChainOfThoughtHeader
                        icon={!group.isDone ? (props: any) => <></> : Atom}
                        className="px-4 py-2.5 rounded-lg border border-border/30 bg-card/30 hover:bg-white/5 transition-colors hidden"
                    >
                        <div className="flex items-center gap-2">
                            {group.isDone ? (
                                <>
                                    <span className="text-sm font-medium">
                                        Done
                                    </span>
                                </>
                            ) : (
                                <Shimmer>
                                    {statusLabel}
                                </Shimmer>
                            )}
                            <Badge variant="secondary">
                                <ClockIcon />
                                {seconds.toFixed(1)} s
                            </Badge>
                        </div>
                    </ChainOfThoughtHeader>

                    <ChainOfThoughtContent className="pb-5 pt-4 w-full">
                        <div className="flex flex-col gap-5 relative ml-4">
                            <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-border" />
                            {group.blocks.map((b: any, idx: number) => {
                                const isStreamingBlock = streaming && isLast && idx === group.blocks.length - 1;
                                const isThinking = b.type === 'thinking';

                                if (isThinking) {
                                    return (
                                        <div key={b.id} className="relative w-full max-w-full pl-8">
                                            <div className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center bg-background z-10">
                                                <Atom className="size-4 text-muted-foreground" />
                                            </div>
                                            <Reasoning isStreaming={isStreamingBlock} duration={b.duration}>
                                                <ReasoningTrigger />
                                                <ReasoningContent className="font-mono text-xs opacity-80 leading-relaxed">{b.text}</ReasoningContent>
                                            </Reasoning>
                                        </div>
                                    );
                                }
                                if (b.type !== 'tool-call' || !b.call) {
                                    return null;
                                }

                                const isDone = b.call.status === 'done';
                                return (
                                    <div key={b.id} className="relative w-full max-w-full pl-8">
                                        <div className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center bg-background z-10">
                                            <ToolIcon name={b.call.name.replace(/_/g, '')} className="size-[18px] text-muted-foreground" />
                                        </div>
                                        <ControlledTool b={b} isDone={isDone}>
                                            <ToolHeader
                                                type="tool-invocation"
                                                state={isDone ? "output-available" : (!isDone && b.awaitConfirm ? "approval-requested" : "input-available")}
                                                title={b.call.name.replace(/_/g, ' ')}
                                                args={b.call.args}
                                                result={b.call.result} />
                                            <ToolContent>
                                                <ToolInput input={b.call.args} name={b.call.name.replace(/_/g, '')} />

                                                {['replacefilecontent', 'multireplacefilecontent', 'replace_file_content', 'multi_replace_file_content'].includes(b.call.name.toLowerCase()) && (
                                                    <DiffViewer
                                                        targetFile={b.call.args.TargetFile}
                                                        targetContent={b.call.args.TargetContent}
                                                        replacementContent={b.call.args.ReplacementContent}
                                                        patch={b.call.result?.diff} />
                                                )}

                                                {!isDone && b.awaitConfirm && (
                                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => onApprove(b.id, b.call.id)}
                                                            className="bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors border-none"
                                                        >
                                                            Approve & Run
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => onReject(b.id, b.call.id)}
                                                            className="bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors border-none"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                )}

                                                {isDone && b.call.result && <ToolOutput output={b.call.result} errorText={b.call.result.error || ""} name={b.call.name.replace(/_/g, '')} />}
                                            </ToolContent>
                                        </ControlledTool>
                                    </div>
                                );
                            })}
                        </div>
                    </ChainOfThoughtContent>
                </ChainOfThought>
            </MessageContent>
        </Message>
    );
}
