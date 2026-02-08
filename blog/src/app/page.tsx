import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Articles about DeFi yield, stablecoins, and treasury management on Arc Network.',
  alternates: {
    canonical: 'https://arctreasury.biz/blog',
  },
  openGraph: {
    title: 'Arc Treasury Blog',
    description: 'Articles about DeFi yield, stablecoins, and treasury management on Arc Network.',
    url: 'https://arctreasury.biz/blog',
    images: [
      {
        url: 'https://arctreasury.biz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Arc Treasury',
      },
    ],
  },
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export default function BlogListPage() {
  const posts = getAllPosts()

  return (
    <div>
      <div className="mb-12">
        <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">
          Blog
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Yield, Stablecoins & DeFi
        </h1>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <Link key={post.slug} href={`/${post.slug}`} className="block group">
            <article className="p-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary-hover hover:border-border-bright transition-all duration-200">
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <time>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
                <span className="w-px h-3 bg-border" />
                <span>{post.author}</span>
              </div>
              <h2 className="text-base font-medium group-hover:text-primary transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {post.description}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {post.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-primary-dim text-primary/80"
                  >
                    {tag}
                  </span>
                ))}
                {post.tags.length > 4 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-primary-dim text-primary/60">
                    +{post.tags.length - 4}
                  </span>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  )
}
