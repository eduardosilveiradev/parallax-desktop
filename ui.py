import streamlit as st
from rag import agent

st.set_page_config(page_title="Codebase RAG Assistant", page_icon="🤖")
st.title("Codebase RAG Assistant")
st.markdown("Ask me anything about your local codebase!")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# React to user input
if prompt := st.chat_input("What would you like to know about the codebase?"):
    # Display user message in chat message container
    st.chat_message("user").markdown(prompt)
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})

    # Display assistant response in chat message container
    with st.chat_message("assistant"):
        with st.spinner("Searching codebase and thinking..."):
            try:
                response = agent.invoke({"messages": [{"role": "user", "content": prompt}]})
                output = response["messages"][-1].content
                st.markdown(output)
                # Add assistant response to chat history
                st.session_state.messages.append({"role": "assistant", "content": output})
            except Exception as e:
                st.error(f"An error occurred: {e}")
