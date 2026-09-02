# Product and Architecture Decisions

## Accepted

### Static-first Cloudflare deployment

Normal pages and map assets will not invoke request-time compute. Cloudflare is the target because its static asset delivery fits the free-only constraint and its bot controls address crawler amplification. Dynamic compute is restricted to justified, bounded endpoints.

### Remove generative AI and Redis

Remove Gemini country information, AI comparisons, their UI and analytics, and Redis caching. Wikipedia remains the information source. Redis has no approved remaining product purpose.

### Pennsylvania school districts first

After the harness and cost-surface work, restoring a reliable school-district map is the first product repair milestone.

## Deferred

### Generated-data storage location

Choose committed artifacts, CI/release artifacts, or object storage after measuring historical and school output sizes and Cloudflare constraints.

### Domain cutover

The owner can access GitHub and Vercel and can create a Cloudflare account. The current DNS registrar/account must be identified before launch.
