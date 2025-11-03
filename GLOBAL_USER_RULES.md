# Global User Rules for Cursor AI

Copy these rules to your Cursor User Rules settings:

---

## Code Commits & AI References
- **NEVER mention Artificial Intelligence, AI, LLM, ChatGPT, or any AI-related terms in commit messages**
- Use generic terms like "optimization", "performance improvements", "code refactoring" instead
- Example: "perf: optimize code with best practices" ✅ NOT "optimize code using AI" ❌

## Security & Private Keys
- **NEVER commit private keys, API keys, secrets, or sensitive credentials to GitHub repositories**
- Always use environment variables (.env files) for sensitive data
- Ensure .env and .env.local are in .gitignore
- Never include:
  - Private keys (crypto wallets, SSH keys)
  - API keys (OpenAI, Vercel tokens, etc.)
  - Database credentials
  - JWT secrets
  - Any authentication tokens

## MCP Tools Usage
- **ALWAYS use MCP (Model Context Protocol) tools when available** instead of direct CLI commands or manual operations
- Prioritize MCP tools for:
  - Vercel deployments (use `mcp_vercel_deploy_to_vercel` or git integration via GitHub MCP)
  - GitHub operations (use GitHub MCP tools instead of git CLI when possible)
  - Library documentation (use Context7 MCP for documentation lookup)
  - Browser automation (use browser MCP tools when needed)
- Only use CLI commands as fallback when MCP tools are not available or not suitable

## Examples

### ✅ Good Commit Messages:
- "perf: optimize React context providers with memoization"
- "refactor: improve build configuration for production"
- "feat: add user authentication flow"

### ❌ Bad Commit Messages:
- "feat: add AI-powered recommendations" ❌
- "optimize: use ChatGPT suggestions" ❌
- "refactor: apply AI code review fixes" ❌

### ✅ Good Security Practices:
```env
# .env (in .gitignore)
PRIVATE_KEY=your_key_here
API_KEY=your_api_key
```

### ❌ Bad Security Practices:
```typescript
// Never do this in code:
const privateKey = "0x1234567890abcdef..." // ❌
const apiKey = "sk-1234567890abcdef..." // ❌
```

### ✅ MCP Usage Priority:
1. Use `mcp_vercel_*` tools for Vercel operations
2. Use `mcp_github_*` tools for GitHub operations
3. Use `mcp_context7_*` tools for library documentation
4. Use CLI only when MCP tools unavailable

---

**Remember: Security first, use MCP tools, keep AI references out of commits**
