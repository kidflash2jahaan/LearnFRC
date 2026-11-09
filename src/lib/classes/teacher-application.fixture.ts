/**
 * A full, realistic second-form teacher application, for teacher-rules.test.ts
 * and scripts/classes/checks/teachers.check.ts. Every written answer clears
 * its floor in TEACH_ANSWERS and none of them trips the effort checks.
 * Test data only: nothing in the app imports this.
 */

export const GOOD_ANSWERS = {
  experience:
    "I've been on the electrical subteam for two seasons. In 2025 I wired the power distribution for our drivetrain and learned to crimp Anderson connectors properly. In 2026 I ran the CAN bus for the whole robot. At our first regional the robot kept browning out during matches. I pulled the logs, found that one of our swerve modules had a loose CAN connection near the frame rail, and we fixed it by adding strain relief and a terminator at the end of the chain. I also trained three rookies on crimping and on reading the PDH channel numbers, which meant writing a one page checklist they still use.",
  teachingSample:
    "Think about a group chat with your whole team. Everyone is in the same chat, and every message has a name on it, so people only read the ones meant for them. A CAN bus works the same way on a robot. Instead of running a separate wire from the roboRIO to every motor controller, we run one pair of twisted wires, yellow and green, from device to device in a chain. Every device on that chain has its own ID number, like a name in the chat. When the roboRIO wants motor 3 to spin, it sends a message addressed to ID 3, and every other device ignores it. That is why two devices with the same ID cause trouble: it is like two people with the same name in the chat, and nobody knows who should answer. The chain also needs a terminator at the far end, which is a small resistor that stops the signal from bouncing back. Without it, messages get garbled and motors stutter. If one connector in the middle comes loose, every device after it drops off the chat. So when a robot suddenly loses several motors at once, the first thing to check is the CAN chain right before the first one that stopped. Here is my check question: if motors 5, 6 and 7 all stop responding but 1 through 4 still work, where would you look first and why?",
  samplePlan:
    "By the end, students should be able to trace a CAN chain on a robot diagram and say where a break would be. I open with the group chat comparison for about three minutes, then share my screen with a wiring diagram of a simple drivetrain. I walk the chain from the roboRIO to the last motor controller and point out the IDs and the terminator. Then I post a broken diagram in chat and ask everyone to type where the break is. Since cameras stay off, chat answers are how I see who is following. Next we look at what the driver station shows when a device drops off. To check they got it, I give two short scenarios and ask them to answer in chat. If I run short, I cut the driver station part and point them to the LearnFRC lesson instead.",
  scenarioSafety:
    "I would answer in the class chat so everyone sees it: I can't move to Discord or any other app, but I'm happy to help with your code right here, and the LearnFRC lesson on this has examples. Then I'd remind everyone not to share their school or other personal details, mute or remove anyone who keeps doing it, and report it after class like the teacher code says.",
  scenarioTeaching:
    "I'd say honestly that I don't know that one and that I'll look it up after class and point them to the right page in the docs, instead of guessing. Then I'd turn to the student who is lost, ask them which step stopped making sense, and go back over that part slowly, using the diagram again before moving on.",
  motivation:
    "I want the volunteer hours, but I also want to get better at explaining things. When I trained rookies on my team I noticed I understood wiring a lot better afterwards, and I'd like to help students on teams without experienced mentors.",
} as const;

/** The raw fields the form sends, every one valid. */
export function goodTeacherApplication(ids: { moduleId: string; lessonId: string; codeVersion: string }) {
  return {
    fullSeason: "yes",
    seasonYear: ["2026"],
    seasonTeam: ["5835"],
    seasonEvents: ["Orange County Regional, Los Angeles Regional"],
    frcRoles: ["electrical"],
    ...GOOD_ANSWERS,
    otherPrograms: "Two years of FLL in middle school",
    topicIds: [ids.moduleId],
    sampleLessonId: ids.lessonId,
    teachOften: "weekly",
    availability: "weekday evenings, Pacific time",
    referenceName: "",
    referenceEmail: "",
    legalName: "  Maya   Chen ",
    codeQuestions: "",
    code: ids.codeVersion,
    ownWords: "yes",
  };
}
