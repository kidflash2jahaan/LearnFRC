import { chooseGoal } from "@/app/start/actions";
import type { GoalOption } from "@/lib/recommend";

/**
 * THE ONE QUESTION.
 *
 * This is the entire first-run decision surface: five answers, each of which
 * is a submit button that records the answer and hands back a five-lesson
 * plan. There is deliberately nothing else on the page.
 *
 * WHY ONE QUESTION AND NOT A PLACEMENT QUIZ: FRC subteam is a role, not a
 * proficiency level, so there is nothing to place. And activation is a
 * same-session event, 70% of everyone who has ever activated completed their
 * first lesson within TEN MINUTES of signing up, median 4.5 minutes, so any
 * intake longer than one tap is spending the window it exists to protect.
 *
 * WHY ASK AT ALL, given every route opens on the same lesson: the answer buys
 * three things the dashboard cannot. It replaces "11 departments / 394
 * lessons" with one named route; it puts the learner's own subteam at lesson
 * TWO instead of lesson 29; and it is a micro-commitment made before any work
 * is asked for. The measured alternative, dropping people on /dashboard, is
 * where 43% of new accounts land today, and they complete a median of ONE
 * lesson against 22 for people who land on a lesson page.
 *
 * WHY A RULED LIST AND NOT A GRID OF TILES: the old version was a two-column
 * card wall where each card carried a coloured department badge, an icon and a
 * row of coloured route chips. In this system a department has no colour of its
 * own, so every one of those chips would have gone grey and said nothing. More
 * to the point, five answers read in one downward pass on a list and in a
 * zig-zag on a grid, and the whole argument for asking at all is that the
 * seconds here are expensive. Each row is a carbon-copy log line: the route it
 * commits you to on the left, the answer in the middle, the length on the
 * right.
 *
 * Server Component on purpose: every row is a plain <form> posting a Server
 * Function, so the whole screen ships zero client JavaScript and there is no
 * hydration boundary anywhere near the first-run path.
 */
export function FirstRunGoalPicker({ goals }: { goals: GoalOption[] }) {
  return (
    <div className="nb-list mt-8">
      {goals.map((goal, i) => (
        <form action={chooseGoal} key={goal.id}>
          <input type="hidden" name="goal" value={goal.id} />
          {/* The whole row is the target. `nb-row` is a grid, so the button
              carries it directly rather than wrapping it: a button inside the
              row would leave most of the row dead to the pointer. */}
          <button
            type="submit"
            className="nb-row w-full cursor-pointer appearance-none border-x-0 border-t-0 bg-transparent px-0 text-left"
          >
            <span className="block">
              <span className="nb-slug block">path / {goal.pathSlug}</span>
              {/* The first answer is the modal one for this audience and the
                  safest default: 328 of 347 accounts are students, and all 156
                  zero-progress accounts are. It is marked rather than made
                  bigger, because a taller first row would push the other four
                  down the page. */}
              {i === 0 && (
                <span className="nb-tag mt-2">start here if unsure</span>
              )}
            </span>

            <span className="block min-w-0">
              <span className="block text-[clamp(1.1rem,0.95rem+0.8vw,1.55rem)] font-extrabold leading-[1.1] tracking-[-0.025em]">
                {goal.label}
              </span>
              <span className="mt-1.5 block max-w-[52ch] text-[0.95rem] leading-snug text-graphite">
                {goal.blurb}
              </span>
              {/* The stops, in order. This is what makes the question worth
                  answering: you can see the answer change what happens next
                  before you commit to it. */}
              <span className="nb-slug mt-2 block max-w-[56ch]">
                {goal.route.map((stop) => stop.name).join("  /  ")}
              </span>
            </span>

            {/* Third and last grid cell. `nb-row` lays out exactly three
                columns, so the screen-reader line rides inside this one rather
                than becoming a fourth cell and wrapping the row. */}
            <span className="nb-slug whitespace-nowrap">
              {goal.route.length} stops
              {/* Named so the answer is traceable back to the published path. */}
              <span className="sr-only">
                . Learning path: {goal.pathTitle}. {goal.outcome}.
              </span>
            </span>
          </button>
        </form>
      ))}
    </div>
  );
}
