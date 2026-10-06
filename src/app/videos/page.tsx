import type { Metadata } from "next";
import Link from "next/link";
import { getAllVideos } from "@/lib/queries";
import { YouTubeFacade } from "@/components/youtube-facade";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Lesson Videos, by Department",
  description:
    "Every LearnFRC lesson video in one place, grouped by department and in course order. Free narrated videos for teaching FRC.",
  alternates: { canonical: `${SITE}/videos` },
  openGraph: {
    title: "FRC Lesson Videos, by Department · LearnFRC",
    description:
      "Every LearnFRC lesson video in one place, grouped by department and in course order.",
    url: `${SITE}/videos`,
    type: "website",
  },
};

/**
 * /videos: just the videos, for someone teaching from them. No lesson text or
 * quizzes, only each department's videos in the same order as the course, so a
 * mentor can put one on a projector and play the next. Each video is a poster
 * until pressed, like on the lesson page, so the page stays light however many
 * there are.
 */
export default async function VideosPage() {
  const departments = await getAllVideos();
  const total = departments.reduce((n, d) => n + d.videos.length, 0);

  return (
    <>
      <section className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <p className="nb-marker">the videos</p>
        <h1 className="max-w-[18ch]">Every lesson video, in course order.</h1>
        <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
          {total} narrated videos so far, grouped by department, with more added
          every week. Each one is the video version of a lesson, so you can play
          them in order to teach a group.
        </p>
        {departments.length > 1 && (
          <nav aria-label="Jump to a department" className="mt-[clamp(1.2rem,2.4vw,1.8rem)] flex flex-wrap gap-2">
            {departments.map((d) => (
              <a key={d.slug} href={`#${d.slug}`} className="nb-btn-ghost">
                {d.name} <span className="tabular-nums">({d.videos.length})</span>
              </a>
            ))}
          </nav>
        )}
      </section>

      {departments.map((d) => (
        <section
          key={d.slug}
          id={d.slug}
          aria-labelledby={`${d.slug}-title`}
          className="nb-wrap scroll-mt-24 pb-[clamp(2.4rem,5vw,3.8rem)]"
        >
          <div className="mb-[clamp(1rem,2vw,1.4rem)] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink pb-2">
            <h2 id={`${d.slug}-title`} className="text-[clamp(1.4rem,1rem+1.5vw,2.1rem)]">
              {d.name}
            </h2>
            <p className="text-[0.92rem] text-graphite tabular-nums">
              {d.videos.length} {d.videos.length === 1 ? "video" : "videos"}
            </p>
          </div>

          <ol className="grid gap-[clamp(1.2rem,2.6vw,2rem)] min-[760px]:grid-cols-2">
            {d.videos.map((v, i) => (
              <li key={v.lessonId} className="min-w-0">
                <div className="nb-box p-[clamp(0.45rem,1vw,0.7rem)]">
                  <YouTubeFacade
                    videoId={v.youtubeId}
                    title={`${v.title}, the LearnFRC video`}
                    sizes="(min-width: 760px) 50vw, 100vw"
                    label="watch"
                    playLabel={`Play ${v.title}`}
                  />
                </div>
                <p className="mt-3 text-[0.8rem] uppercase tracking-[0.06em] text-graphite">
                  <span className="tabular-nums">{i + 1}.</span> {v.moduleTitle}
                </p>
                <h3 className="mt-1 text-[1.08rem] leading-snug">{v.title}</h3>
                <p className="mt-1 text-[0.88rem]">
                  <Link href={v.href} className="nb-link">
                    Open the lesson
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
