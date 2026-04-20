const fs = require('fs');

function getFiles(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.next') continue;
        const name = dir + '/' + file;
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, filesList);
        } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
            filesList.push(name);
        }
    }
    return filesList;
}

const map = {
  "BotIcon": "Robot",
  "XIcon": "X",
  "FileTextIcon": "FileText",
  "GlobeIcon": "Globe",
  "ImageIcon": "Image",
  "Music2Icon": "MusicNotes",
  "PaperclipIcon": "Paperclip",
  "VideoIcon": "Video",
  "BrainIcon": "Brain",
  "ChevronDownIcon": "CaretDown",
  "DotIcon": "Circle",
  "BookmarkIcon": "BookmarkSimple",
  "CheckIcon": "Check",
  "CopyIcon": "Copy",
  "FileIcon": "File",
  "GitCommitIcon": "GitCommit",
  "MinusIcon": "Minus",
  "PlusIcon": "Plus",
  "ArrowDownIcon": "ArrowDown",
  "DownloadIcon": "DownloadSimple",
  "EyeIcon": "Eye",
  "EyeOffIcon": "EyeClosed",
  "ChevronRightIcon": "CaretRight",
  "FolderIcon": "Folder",
  "FolderOpenIcon": "FolderOpen",
  "ArrowLeftIcon": "ArrowLeft",
  "ArrowRightIcon": "ArrowRight",
  "AlertCircle": "WarningCircle",
  "ChevronLeftIcon": "CaretLeft",
  "ChevronsUpDownIcon": "ArrowsVertical",
  "ExternalLinkIcon": "ArrowSquareOut",
  "Message सर्कलIcon": "ChatCircle",
  "MessageCircleIcon": "ChatCircle",
  "PackageIcon": "Package",
  "CornerDownLeftIcon": "ArrowElbowDownLeft",
  "Monitor": "Monitor",
  "SquareIcon": "Square",
  "Code": "Code",
  "CheckCircleIcon": "CheckCircle",
  "CircleIcon": "Circle",
  "ClockIcon": "Clock",
  "WrenchIcon": "Wrench",
  "XCircleIcon": "XCircle",
  "TerminalIcon": "TerminalWindow",
  "SearchIcon": "MagnifyingGlass",
  "ClipboardIcon": "ClipboardText",
  "PencilIcon": "PencilSimple",
  "ChevronUpIcon": "CaretUp",
  "Loader2Icon": "SpinnerGap"
};

const allFiles = getFiles('src');

allFiles.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('lucide-react')) {
        // find all used lucide icons in this file
        const regex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;
        let p;
        let imported = [];
        while ((p = regex.exec(content)) !== null) {
            imported.push(...p[1].split(',').map(i => i.trim()).filter(i => i));
        }

        // replace the imports string
        content = content.replace(/['"]lucide-react['"]/g, '"@phosphor-icons/react"');

        // rename the words in the file
        for (const i of imported) {
            let originalName = i;
            if (i.includes(' as ')) {
                originalName = i.split(' as ')[0].trim();
            }
            if (map[originalName]) {
                const targetName = map[originalName];
                const re = new RegExp(`\\b${originalName}\\b`, 'g');
                content = content.replace(re, targetName);
            } else {
                console.log("WARNING: MISSING MAPPING FOR", originalName);
            }
        }

        fs.writeFileSync(f, content, 'utf8');
    }
});
console.log("Done mapped!");
