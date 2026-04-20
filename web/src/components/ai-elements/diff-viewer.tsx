import React from 'react';
import * as diff from 'diff';

interface DiffViewerProps {
    patch?: string;
    targetFile?: string;
    targetContent?: string;
    replacementContent?: string;
}

export function DiffViewer({ patch, targetFile, targetContent, replacementContent }: DiffViewerProps) {
    let diffLines: string[] = [];

    if (patch) {
        diffLines = patch.split('\n');
    } else if (typeof targetContent === 'string' && typeof replacementContent === 'string') {
        try {
            const generatedPatch = diff.createPatch(targetFile || 'file', targetContent, replacementContent);
            diffLines = generatedPatch.split('\n');
        } catch (e) {
            diffLines = [`Error generating diff: ${e}`];
        }
    }

    if (diffLines.length === 0) return null;

    const filtered = diffLines.filter(l => !l.startsWith('===') && !l.startsWith('---') && !l.startsWith('+++') && !l.startsWith('Index:') && l.trim() !== '\\ No newline at end of file');

    let oldLine = 0;
    let newLine = 0;

    return (
        <div className="flex flex-col font-mono text-xs mt-2 border border-border/50 rounded overflow-hidden bg-background">
            {filtered.map((line, idx) => {
                if (line.startsWith('@@')) {
                    const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                    if (match) {
                        oldLine = parseInt(match[1]);
                        newLine = parseInt(match[2]);
                    }

                    let plusCount = 0;
                    let minusCount = 0;
                    for (let i = idx + 1; i < filtered.length; i++) {
                        if (filtered[i].startsWith('@@')) break;
                        if (filtered[i].startsWith('+')) plusCount++;
                        if (filtered[i].startsWith('-')) minusCount++;
                    }

                    return (
                        <div key={idx} className="flex items-center px-3 py-1.5 bg-muted/30 border-y border-border/50 text-muted-foreground">
                            <span className="opacity-50 tracking-widest mr-2">··</span>
                            {minusCount > 0 && <span className="text-destructive font-medium mr-2">-{minusCount}</span>}
                            {plusCount > 0 && <span className="text-green-500 font-medium mr-2">+{plusCount}</span>}
                            <span className="opacity-50">{(plusCount > 0 || minusCount > 0) ? 'lines' : 'Context'}</span>
                        </div>
                    );
                }

                let oldCol = '';
                let newCol = '';
                
                if (line.startsWith('+')) {
                    newCol = String(newLine++);
                    return (
                        <div key={idx} className="flex flex-row bg-green-500/10">
                            <div className="flex shrink-0 w-12 border-r border-border/30 opacity-50 px-1 py-0.5 justify-between select-none">
                                <span>{oldCol}</span>
                                <span>{newCol}</span>
                            </div>
                            <div className="text-green-500 px-2 py-0.5 whitespace-pre-wrap break-all">{line}</div>
                        </div>
                    );
                } else if (line.startsWith('-')) {
                    oldCol = String(oldLine++);
                    return (
                        <div key={idx} className="flex flex-row bg-destructive/10">
                            <div className="flex shrink-0 w-12 border-r border-border/30 opacity-50 px-1 py-0.5 justify-between select-none">
                                <span>{oldCol}</span>
                                <span>{newCol}</span>
                            </div>
                            <div className="text-destructive px-2 py-0.5 whitespace-pre-wrap break-all">{line}</div>
                        </div>
                    );
                } else {
                    oldCol = String(oldLine++);
                    newCol = String(newLine++);
                    return (
                        <div key={idx} className="flex flex-row hover:bg-muted/10">
                            <div className="flex shrink-0 w-12 border-r border-border/30 opacity-50 px-1 py-0.5 justify-between select-none">
                                <span>{oldCol}</span>
                                <span>{newCol}</span>
                            </div>
                            <div className="opacity-70 px-2 py-0.5 whitespace-pre-wrap break-all">{line}</div>
                        </div>
                    );
                }
            })}
        </div>
    );
}
