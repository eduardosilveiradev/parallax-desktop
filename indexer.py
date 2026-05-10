from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
import os
from pathlib import Path
import concurrent.futures
from tqdm import tqdm

# 1. CONFIGURATION
REPO_PATH = "."  # Point this to your code
DB_PATH = "./chroma_db"  # Where the vector data will live
LM_STUDIO_URL = "http://localhost:1234/v1"

# 2. LOAD ALL FILES (IN PARALLEL)
print("Scanning directory for files...")
valid_paths = []
exclude_dirs = {
    ".venv",
    "node_modules",
    ".git",
    "dist",
    ".next",
    "build",
    "__pycache__",
    "chroma_db",
    "out",
    "web-out",
    ".vite",
    ".turbo",
    "release",
}

exclude_files = {
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
}

valid_extensions = {
    ".ts", ".tsx", ".js", ".jsx", 
    ".py", ".md", ".css", ".html"
}

for root, dirs, files in os.walk(REPO_PATH):
    # Modify dirs in-place to completely skip searching inside junk directories!
    dirs[:] = [d for d in dirs if d not in exclude_dirs]

    for file in files:
        if file in exclude_files:
            continue
        if Path(file).suffix not in valid_extensions:
            continue
        valid_paths.append(Path(root) / file)

documents = []

def load_file(path):
    try:
        loader = TextLoader(str(path), encoding="utf-8")
        return loader.load()
    except Exception:
        return []

print(f"Loading {len(valid_paths)} files in parallel...")
with concurrent.futures.ThreadPoolExecutor() as executor:
    futures = {executor.submit(load_file, p): p for p in valid_paths}
    with tqdm(total=len(valid_paths), desc="Loading Files") as pbar:
        for future in concurrent.futures.as_completed(futures):
            path = futures[future]
            # Show the name of the file currently finishing loading
            pbar.set_postfix_str(path.name)
            try:
                documents.extend(future.result())
            except Exception:
                pass
            pbar.update(1)

print(f"Loaded {len(documents)} valid text files.")

# 3. SPLIT INTO CHUNKS (LANGUAGE AWARE)
print("Splitting documents into chunks using AST/language breakpoints...")

EXTENSION_TO_LANGUAGE = {
    ".py": Language.PYTHON,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".md": Language.MARKDOWN,
    ".html": Language.HTML,
}

texts = []
default_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
language_splitters = {}

with tqdm(documents, desc="Splitting") as pbar:
    for doc in pbar:
        source = doc.metadata.get("source", "")
        # Show the name of the file being split
        pbar.set_postfix_str(Path(source).name)
        ext = Path(source).suffix.lower()
        
        lang = EXTENSION_TO_LANGUAGE.get(ext)
        if lang:
            if lang not in language_splitters:
                language_splitters[lang] = RecursiveCharacterTextSplitter.from_language(
                    language=lang, chunk_size=500, chunk_overlap=50
                )
            texts.extend(language_splitters[lang].split_documents([doc]))
        else:
            texts.extend(default_splitter.split_documents([doc]))

print(f"Split into {len(texts)} chunks.")

# 4. EMBED AND STORE (Using Nomad via LM Studio)
embeddings = OpenAIEmbeddings(
    base_url=LM_STUDIO_URL,
    api_key="lm-studio",
    model="text-embedding-nomic-embed-text-v1.5",
    check_embedding_ctx_length=False,
)

# Batch ingestion to avoid overloading LM Studio and to show a progress bar
print("Generating embeddings and saving to ChromaDB...")
vector_db = Chroma(persist_directory=DB_PATH, embedding_function=embeddings)

BATCH_SIZE = 100  # Adjust this based on your GPU/LM Studio memory capacity
with tqdm(range(0, len(texts), BATCH_SIZE), desc="Embedding Chunks") as pbar:
    for i in pbar:
        batch = texts[i : i + BATCH_SIZE]
        # Show the name of the file that the first chunk of this batch belongs to
        if batch:
            source = batch[0].metadata.get("source", "")
            pbar.set_postfix_str(Path(source).name)
        vector_db.add_documents(batch)

print(f"\nSuccessfully indexed codebase to {DB_PATH}")
