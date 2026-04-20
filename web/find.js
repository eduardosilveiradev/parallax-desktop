const fs = require('fs');
const path = require('path');

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

const allFiles = getFiles('src');
const lucideImports = new Set();
const fileByIcon = {};

allFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const match = content.search(/['"]lucide-react['"]/);
    if (match !== -1) {
        // extract the actual block
        const regex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;
        let p;
        while ((p = regex.exec(content)) !== null) {
            const icons = p[1].split(',').map(i => i.trim()).filter(i => i);
            icons.forEach(i => {
                let name = i;
                if (i.includes(' as ')) {
                    name = i.split(' as ')[0].trim();
                }
                lucideImports.add(name);
                if (!fileByIcon[name]) fileByIcon[name] = [];
                fileByIcon[name].push(f);
            });
        }
    }
});

console.log(JSON.stringify(Array.from(lucideImports), null, 2));
