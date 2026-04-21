"use client";

import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
    CheckCircle,
    CaretDown,
    Circle,
    Clock,
    XCircle,
    QuestionMarkIcon,
    StrategyIcon,
    PencilSimpleIcon,
    WrenchIcon,
    FolderIcon,
    TerminalWindowIcon,
    MagnifyingGlassIcon,
    GlobeIcon,
    ClipboardTextIcon,
    EyeIcon
} from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";
import path from "path";
import { BundledLanguage } from "shiki";
import { Shimmer } from "./shimmer";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
    <Collapsible
        className={cn("group not-prose mb-4 w-full", className)}
        {...props}
    />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
    title?: string;
    className?: string;
    args?: any;
    result?: any;
} & (
        | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
        | {
            type: DynamicToolUIPart["type"];
            state: DynamicToolUIPart["state"];
            toolName: string;
        }
    );

const statusLabels: Record<ToolPart["state"], string> = {
    "approval-requested": "Awaiting Approval",
    "approval-responded": "Responded",
    "input-available": "Running",
    "input-streaming": "Pending",
    "output-available": "Completed",
    "output-denied": "Denied",
    "output-error": "Error",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
    "approval-requested": <Clock className="size-4 text-yellow-600" />,
    "approval-responded": <CheckCircle className="size-4 text-blue-600" />,
    "input-available": <Clock className="size-4 animate-pulse" />,
    "input-streaming": <Circle className="size-4" />,
    "output-available": <CheckCircle className="size-4 text-green-600" />,
    "output-denied": <XCircle className="size-4 text-orange-600" />,
    "output-error": <XCircle className="size-4 text-red-600" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
    <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
        {statusIcons[status]}
        {statusLabels[status]}
    </Badge>
);


function getToolLabel(name: string, args: any, status: 'calling' | 'done', result?: any): ReactNode {
    const isDone = status === 'done';
    const isFail = isDone && result && typeof result === 'object' && result.success === false;
    const filePath = args?.TargetFile || args?.AbsolutePath || args?.DirectoryPath || args?.path;
    const fileName = filePath ? path.basename(filePath) : '';
    const cmdLine = args?.CommandLine || args?.command;
    const cmdId = args?.CommandId || args?.commandId;

    if (isFail) {
        switch (name) {
            case 'AskQuestion': return `Failed to collect answers`;
            case 'CreatePlan': return `Failed to create plan`;
            case 'TodoWrite': return `Failed to update todos`;
            case 'SwitchMode': return `Failed to switch mode`;
            case 'Task': return `Task failed`;
            case 'ListDir': return `Failed to list ${filePath}`;
            case 'ViewFile': return `Failed to read ${fileName}`;
            case 'WriteToFile': return `Failed to write ${fileName}`;
            case 'ReplaceFileContent':
            case 'MultiReplaceFileContent': return `Failed to edit ${fileName}`;
            case 'RunCommand': return `Failed to run command`;
            case 'CommandStatus': return `Failed to check command ${cmdId}`;
            case 'SendCommandInput': return `Failed to send input to ${cmdId}`;
            case 'GrepSearch': return `Failed to search codebase`;
            case 'SearchWeb': return `Failed to search web`;
            case 'ReadUrlContent': return `Failed to read URL`;
            case 'ReadClipboard': return `Failed to read clipboard`;
            case 'WriteClipboard': return `Failed to write clipboard`;
            default: return `Failed ${name}`;
        }
    }

    const lineInfo = (() => {
        try {
            if (name === 'WriteToFile' && args?.CodeContent) {
                return <span><span className="opacity-70 ml-1"></span><span className="text-green-500 font-medium">+{args.CodeContent.split('\n').length}</span><span className="opacity-70 ml-1"></span></span>;
            }
            if (name === 'ReplaceFileContent') {
                const addTarget = args?.TargetContent ? args.TargetContent.split('\n').length : 0;
                const addReplace = args?.ReplacementContent ? args.ReplacementContent.split('\n').length : 0;
                if (addTarget > 0 || addReplace > 0) {
                    return (
                        <span>
                            <span className="opacity-70 ml-1"></span>
                            {addTarget > 0 && <span className="text-destructive font-medium">-{addTarget}</span>}
                            {addTarget > 0 && addReplace > 0 && <span className="mx-1.5"></span>}
                            {addReplace > 0 && <span className="text-green-500 font-medium">+{addReplace}</span>}
                            <span className="opacity-70 ml-1"></span>
                        </span>
                    );
                }
            }
            if (name === 'MultiReplaceFileContent' && args?.ReplacementChunks) {
                let addTarget = 0, addReplace = 0;
                for (const chunk of args.ReplacementChunks) {
                    addTarget += chunk.TargetContent ? chunk.TargetContent.split('\n').length : 0;
                    addReplace += chunk.ReplacementContent ? chunk.ReplacementContent.split('\n').length : 0;
                }
                if (addTarget > 0 || addReplace > 0) {
                    return (
                        <span>
                            <span className="opacity-70 ml-1"></span>
                            {addTarget > 0 && <span className="text-destructive font-medium">-{addTarget}</span>}
                            {addTarget > 0 && addReplace > 0 && <span className="mx-1.5"></span>}
                            {addReplace > 0 && <span className="text-green-500 font-medium">+{addReplace}</span>}
                            <span className="opacity-70 ml-1"></span>
                        </span>
                    );
                }
            }
            if (name === 'ViewFile') {
                if (args?.StartLine && args?.EndLine) {
                    return <span><span className="opacity-70 ml-1">#L{args.StartLine}-{args.EndLine}</span></span>;
                } else {
                    return <span><span className="opacity-70 ml-1">{result.content.split('\n').length} lines</span></span>;
                }
            }
        } catch { }
        return null;
    })();

    switch (name) {
        case 'AskQuestion':
            return isDone ? `Collected answers` : `Asking questions`;
        case 'CreatePlan':
            return isDone ? `Created plan` : `Creating plan`;
        case 'TodoWrite':
            return isDone ? `Updated todos` : `Updating todos`;
        case 'SwitchMode':
            return isDone ? `Switched mode` : `Switching mode`;
        case 'Task':
            return isDone ? `Task finished` : `Running task`;
        case 'ListDir':
            return isDone ? `Listed ${filePath}` : `Listing ${filePath}`;
        case 'ViewFile':
            return <span>{isDone ? `Read ${fileName}` : `Reading ${fileName}`}{lineInfo}</span>;
        case 'WriteToFile':
            return <span>{isDone ? `Wrote ${fileName}` : `Writing ${fileName}`}{lineInfo}</span>;
        case 'ReplaceFileContent':
        case 'MultiReplaceFileContent':
            return <span>{isDone ? `Edited ${fileName}` : `Editing ${fileName}`}{lineInfo}</span>;
        case 'RunCommand':
            return isDone ? `Ran ${cmdLine}` : `Running ${cmdLine}`;
        case 'CommandStatus':
            return isDone ? `Checked command ${cmdId}` : `Checking command ${cmdId}`;
        case 'SendCommandInput':
            return isDone ? `Sent input to ${cmdId}` : `Sending input to ${cmdId}`;
        case 'GrepSearch':
            return isDone ? `Searched for "${args?.Query}"` : `Searching for "${args?.Query}"`;
        case 'SearchWeb':
            return isDone ? `Searched web for "${args?.query}"` : `Searching web for "${args?.query}"`;
        case 'ReadUrlContent':
            return isDone ? `Read ${args?.Url}` : `Reading ${args?.Url}`;
        case 'ReadClipboard':
            return isDone ? `Read clipboard` : `Reading clipboard`;
        case 'WriteClipboard':
            return isDone ? `Wrote to clipboard` : `Writing to clipboard`;
        default:
            if (name.includes('_')) {
                const [server, ...tool] = name.split('_');
                const toolName = tool.join('_');
                return isDone ? `${server}: Finished ${toolName}` : `${server}: Calling ${toolName}`;
            }
            return isDone ? `Finished ${name}` : `Calling ${name}`;
    }
}

function ToolIcon({ name, className }: { name: string, className?: string }) {
    switch (name) {
        case 'AskQuestion': return <QuestionMarkIcon className={className} />;
        case 'CreatePlan': return <StrategyIcon className={className} />;
        case 'TodoWrite': return <PencilSimpleIcon className={className} />;
        case 'SwitchMode': return <WrenchIcon className={className} />;
        case 'Task': return <WrenchIcon className={className} />;
        case 'ListDir': return <FolderIcon className={className} />;
        case 'ViewFile': return <EyeIcon className={className} />;
        case 'WriteToFile':
        case 'ReplaceFileContent':
        case 'MultiReplaceFileContent': return <PencilSimpleIcon className={className} />;
        case 'RunCommand':
        case 'CommandStatus':
        case 'SendCommandInput': return <TerminalWindowIcon className={className} />;
        case 'GrepSearch': return <MagnifyingGlassIcon className={className} />;
        case 'SearchWeb':
        case 'ReadUrlContent': return <GlobeIcon className={className} />;
        case 'ReadClipboard':
        case 'WriteClipboard': return <ClipboardTextIcon className={className} />;
        default: return <WrenchIcon className={className} />;
    }
}

export const ToolHeader = ({
    className,
    title,
    type,
    state,
    toolName,
    args,
    result,
    ...props
}: ToolHeaderProps) => {
    return (
        <CollapsibleTrigger
            className={cn(
                "flex w-full items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground",
                className
            )}
            {...props}
        >
            <ToolIcon name={title || toolName || type || ''} className="size-4" />
            {state.startsWith('output-') ? (
                <span>{getToolLabel(title || toolName || type || '', args, 'done', result)}</span>
            ) : (
                <Shimmer>
                    {getToolLabel(title || toolName || type || '', args, 'calling', result)}
                </Shimmer>
            )}
            {getStatusBadge(state)}
            <CaretDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
    );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
    <CollapsibleContent
        className={cn(
            "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
            className
        )}
        {...props}
    />
);

export type ToolInputProps = ComponentProps<"div"> & {
    input: any;
    name?: string;
};

export const ToolInput = ({ className, input, name, ...props }: ToolInputProps) => {
    if (!input || typeof input !== 'object') return null;

    return (
        <div className={cn("space-y-3 overflow-hidden text-sm", className)} {...props}>
            {Object.entries(input).map(([key, value]) => {
                if (key === 'ReplacementChunks' || key === 'TargetContent' || key === 'ReplacementContent') return null;

                const isMultiline = typeof value === 'string' && value.includes('\n');

                return (
                    <div key={key} className="space-y-1.5">
                        <span className="font-medium text-muted-foreground text-[10px] uppercase tracking-wide">{key}</span>
                        {isMultiline ? (
                            <div className="rounded-md border border-border/50 bg-muted/30">
                                <CodeBlock code={value as string} language={name === 'WriteToFile' ? 'text' as BundledLanguage : 'json'} />
                            </div>
                        ) : (
                            <div className="font-mono text-xs p-2 rounded bg-muted/50 text-foreground break-all">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export type ToolOutputProps = ComponentProps<"div"> & {
    output: any;
    errorText?: string;
    name?: string;
};

export const ToolOutput = ({
    className,
    output,
    errorText,
    name,
    ...props
}: ToolOutputProps) => {
    if (!(output || errorText)) {
        return null;
    }

    let Output: ReactNode = null;
    if (errorText) {
        Output = <div className="p-3 bg-destructive/10 text-destructive rounded-md">{errorText}</div>;
    } else if (typeof output === "object" && !isValidElement(output)) {
        if (output.content && typeof output.content === 'string') {
            const isFile = !!(output.path && name === 'ViewFile');
            const lang = (isFile ? path.extname(output.path as string).slice(1) : 'text') as BundledLanguage;
            Output = <div className="border border-border/50 rounded-md overflow-hidden bg-muted/30"><CodeBlock code={output.content} language={lang} /></div>;
        } else if (output.diff && typeof output.diff === 'string') {
            Output = null; // Let the DiffViewer render it
        } else if (name === 'ListDir' && output.content) {
            Output = <div className="border border-border/50 rounded-md overflow-hidden bg-muted/30"><CodeBlock code={output.content} language="bash" /></div>;
        } else if (output.matches) {
            Output = <div className="border border-border/50 rounded-md overflow-hidden bg-muted/30"><CodeBlock code={JSON.stringify(output.matches, null, 2)} language="json" /></div>;
        } else {
            Output = <div className="border border-border/50 rounded-md overflow-hidden bg-muted/30"><CodeBlock code={JSON.stringify(output, null, 2)} language="json" /></div>;
        }
    } else if (typeof output === "string") {
        Output = <div className="border border-border/50 rounded-md overflow-hidden bg-muted/30"><CodeBlock code={output} language="json" /></div>;
    }

    if (!Output) return null;

    return (
        <div className={cn("space-y-2", className)} {...props}>
            <h4 className="font-medium text-muted-foreground text-[10px] uppercase tracking-wide pt-2">
                {errorText ? "Error" : "Result"}
            </h4>
            <div className="overflow-x-auto text-xs [&_table]:w-full">
                {Output}
            </div>
        </div>
    );
};
