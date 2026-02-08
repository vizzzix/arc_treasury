import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import { getAllSlugs, getPostBySlug } from '@/lib/blog'

interface PageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const slugs = getAllSlugs()
  if (!slugs.includes(params.slug)) return {}

  const post = getPostBySlug(params.slug)

  const canonical = `https://arctreasury.biz/blog/${params.slug}`

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [
        {
          url: 'https://arctreasury.biz/og-image.png',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: ['https://arctreasury.biz/og-image.png'],
    },
  }
}

function FaqSchema({ faq }: { faq: { question: string; answer: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export default function BlogPostPage({ params }: PageProps) {
  const slugs = getAllSlugs()
  if (!slugs.includes(params.slug)) notFound()

  const post = getPostBySlug(params.slug)
  const readingTime = estimateReadingTime(post.content)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      '@type': 'Organization',
      name: post.author,
      url: 'https://arctreasury.biz',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Arc Treasury',
      url: 'https://arctreasury.biz',
      logo: {
        '@type': 'ImageObject',
        url: 'https://arctreasury.biz/og-image.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://arctreasury.biz/blog/${params.slug}`,
    },
    image: 'https://arctreasury.biz/og-image.png',
    keywords: post.tags.join(', '),
  }

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {post.faq && post.faq.length > 0 && <FaqSchema faq={post.faq} />}

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        All posts
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <time>
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
          <span className="w-px h-3 bg-border" />
          <span>{readingTime} min read</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight leading-snug">
          {post.title}
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed text-sm">
          {post.description}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-md bg-primary-dim text-primary/80"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      <div className="prose-blog">
        <MDXRemote
          source={post.content}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [rehypeSlug, rehypeHighlight],
            },
          }}
        />
      </div>

      {post.faq && post.faq.length > 0 && (
        <section className="mt-14 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold tracking-tight mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {post.faq.map((item, i) => (
              <details key={i} className="group rounded-lg border border-border bg-secondary/40 overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer text-sm font-medium hover:bg-secondary-hover transition-colors select-none">
                  {item.question}
                  <svg
                    className="w-4 h-4 text-muted-foreground shrink-0 ml-4 group-open:rotate-180 transition-transform"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
