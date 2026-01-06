import type { APIRoute } from 'astro'

interface GithubRepoData {
  owner: { avatar_url: string }
  description: string | null
  stargazers_count: number
  forks_count: number
  license: { spdx_id: string } | null
}

// In-memory cache with 1 hour TTL
const cache = new Map<string, { data: GithubRepoData, timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// Mark this route as server-side rendered
export const prerender = false

export const GET: APIRoute = async ({ params }) => {
  const repo = params.repo

  if (!repo || !repo.includes('/')) {
    return new Response(JSON.stringify({ error: 'Invalid repo format. Use owner/repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check memory cache first
  const cached = cache.get(repo)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'HIT',
      },
    })
  }

  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Astro-Theme-Retypeset',
    }

    // Use GITHUB_TOKEN if available (5000 req/hr vs 60 req/hr)
    const token = import.meta.env.GITHUB_TOKEN
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`https://api.github.com/repos/${repo}`, { headers })

    if (!response.ok) {
      const error = await response.json()
      return new Response(JSON.stringify(error), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const raw = await response.json()
    const data: GithubRepoData = {
      owner: { avatar_url: raw.owner?.avatar_url },
      description: raw.description,
      stargazers_count: raw.stargazers_count,
      forks_count: raw.forks_count,
      license: raw.license ? { spdx_id: raw.license.spdx_id } : null,
    }

    // Update cache
    cache.set(repo, { data, timestamp: Date.now() })

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
      },
    })
  }
  catch (error) {
    console.error(`[GitHub API] Failed to fetch ${repo}:`, error)
    return new Response(JSON.stringify({ error: 'Failed to fetch repository data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
