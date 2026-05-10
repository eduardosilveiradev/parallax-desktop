import os
from langchain_community.llms import OpenAI
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.tools import Tool
from langgraph.prebuilt import create_react_agent

# 1. SETUP LM STUDIO CLIENTS
# LM Studio mimics the OpenAI API structure
base_url = "http://localhost:1234/v1"

llm = ChatOpenAI(
    base_url=base_url, api_key="lm-studio", model="gemma-4-e4b", temperature=0
)

# Nomad embeddings via LM Studio
embeddings = OpenAIEmbeddings(
    base_url=base_url,
    api_key="lm-studio",
    model="text-embedding-nomic-embed-text-v1.5",
    check_embedding_ctx_length=False,
)

# 2. RAG RETRIEVER (Codebase Search)
# Assuming you've already indexed your codebase into 'chroma_db'
# If not, use: Chroma.from_documents(documents, embeddings, persist_directory="./chroma_db")
vector_db = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)


def codebase_search(query: str):
    """Searches the local codebase for relevant logic and documentation."""
    print(f"\n[🔧 TOOL EXECUTION] Running codebase_search with query: '{query}'")
    docs = vector_db.similarity_search(query, k=3)
    print(f"[🔧 TOOL EXECUTION] Retrieved {len(docs)} chunks from ChromaDB.")
    return "\n\n".join([doc.page_content for doc in docs])


# 3. DEFINE TOOLS
tools = [
    Tool(
        name="CodebaseSearch",
        func=codebase_search,
        description="Useful for when you need to answer questions about the specific codebase or local files.",
    )
]

# 4. INITIALIZE REACT AGENT
system_prompt = "You are an expert software engineer assistant. Use the codebase search tool to investigate the user's queries about the codebase."
agent = create_react_agent(llm, tools=tools, prompt=system_prompt)

if __name__ == "__main__":
    # 5. EXECUTION
    prompt_input = "Explain how the login logic works in this codebase and suggest a fix for session timeouts."

    print("--- Starting Agentic Loop ---")
    inputs = {"messages": [{"role": "user", "content": prompt_input}]}
    
    # Run the graph and print outputs
    for chunk in agent.stream(inputs, stream_mode="updates"):
        for node, values in chunk.items():
            print(f"\n--- {node.upper()} ---")
            if "messages" in values:
                for msg in values["messages"]:
                    print(msg.content)
