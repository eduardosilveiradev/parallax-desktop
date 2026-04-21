$env:CI="true"
# Build Next.js
cd web
pnpm build
cd ..

# Build Shell
cd src
pnpm build
pnpm copy:daemon
pnpm install:daemon
pnpm copy:web
cd ..

# Run electron-builder via npx
npx electron-builder --project src --win nsis portable
