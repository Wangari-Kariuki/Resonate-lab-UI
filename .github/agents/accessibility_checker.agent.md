---
name: accessibility_checker
description: Describe what this custom agent does and when to use it.


Use this agent to review HTML files in the frontend folder for common accessibility issues before establishing or merging changes. It should check for incorrect semantic markup, improper tabindex usage on buttons and links, missing or weak aria-labels values, and missing or unhelpful alt text on images. It should report issues clearly, explain why the matter and suggest practical fixes

argument-hint: The inputs this agent expects, e.g., "a task to implement" or "a question to answer".
# tools: ['vscode', 'execute', 'read', 'agent', 'edit', 'search', 'web', 'todo'] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

<!-- Tip: Use /create-agent in chat to generate content with agent assistance -->


<!-- Flag wrong semantics in all .htm files located in Frontend folder
Flag and give suggestions for tabindex attribute in button and link tags
Flag incorrect or no aria-label descriptions of elements in .html files
 Flag incorrect or no descriptions of  alt text attribute in <img> tags -->

Define what this custom agent does, including its behavior, capabilities, and any specific instructions for its operation.