// GENERATED from LearnFRC's live public catalog (read-only reads of departments,
// modules, lessons, articles, achievements) and the site's glossary-data.ts and
// paths-data.ts on 2026-10-13. Real text, trimmed to a small set for previews.
// The ids are real, so routes and lookups behave as they do in the app.

import Foundation

extension PreviewData {
    /// Two real departments with a handful of real modules and lessons each.
    static let departments: [Department] = [
        Department(
            id: UUID(uuidString: "96b4f59a-938b-4896-8699-6236d75531a8")!,
            slug: "programming-software",
            name: "Programming, Controls & Sensors",
            tagline: "Code the robot with WPILib — plus sensors, vision & control.",
            description: "The Programming & Software branch is where robot hardware comes to life. FRC programmers use WPILib (the official robotics library) to read sensors and controllers, drive motors, run autonomous routines, and tune precise closed-loop control. This guide takes a motivated beginner from installing the toolchain to writing a clean command-based robot with PID/feedforward control, trajectory following, odometry, and simulation. Every API, part name, and tool is verified against current WPILib, CTRE Phoenix 6, and REVLib 2025/2026 documentation so you learn what teams actually ship today.",
            difficulty: "All Levels",
            estimatedHours: 37,
            whatYoullLearn: ["Install the WPILib toolchain, FRC Game Tools, and Driver Station, then build and deploy code to a roboRIO", "Understand WPILib's three officially supported text-based languages (Java, C++, Python/RobotPy) and the TimedRobot lifecycle", "Structure and write a command-based robot with Subsystems, Commands, and Triggers", "Control motors with vendor APIs: CTRE Phoenix 6 (Talon FX / Kraken X60 / Kraken X44) and REVLib 2025 (SPARK MAX/Flex, NEO/NEO Vortex)", "Read joysticks and gamepads and bind buttons to commands"],
            prerequisites: ["Basic programming concepts (variables, methods, classes, if/loops) in any language — Java recommended", "A computer running Windows, macOS, or Linux (Windows is required to run the official Driver Station and roboRIO Imaging Tool, which ship in the NI FRC Game Tools)", "Familiarity with the robot's electronics is helpful but not required (see the Electrical branch)"],
            tools: ["WPILib (WPILibJ / WPILibC / RobotPy)", "Visual Studio Code with the WPILib extension", "FRC Game Tools (NI): FRC Driver Station + roboRIO Imaging Tool", "Gradle (GradleRIO build system)", "roboRIO 1.0 / roboRIO 2.0"],
            sources: [SourceLink(title: "WPILib FRC Documentation (frc-docs)", url: URL(string: "https://docs.wpilib.org/en/stable/")!), SourceLink(title: "What Is WPILib? — supported languages", url: URL(string: "https://docs.wpilib.org/en/stable/docs/software/what-is-wpilib.html")!), SourceLink(title: "FRC Control System Software Overview (language status)", url: URL(string: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-software.html")!)],
            icon: "Code2",
            sortOrder: 3,
            modules: [
                Module(
                    id: UUID(uuidString: "90692a57-558a-4037-954d-8b71df1db139")!, departmentID: UUID(uuidString: "96b4f59a-938b-4896-8699-6236d75531a8")!, slug: "prerequisites",
                    title: "Programming Foundations: A Java Primer",
                    overview: "A beginner-friendly primer that builds the core programming and Java fundamentals every newcomer needs before writing a single line of FRC robot code. Start from absolute zero with variables, control flow, and objects, then learn why FRC robots are programmed in Java and how to read the WPILib library you'll lean on all season. Complete this before diving into the department's main robot-code lessons.",
                    sortOrder: -1, isPrerequisite: true,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "ae85a782-97d4-4bb7-af56-fe73906e217a")!, moduleID: UUID(uuidString: "90692a57-558a-4037-954d-8b71df1db139")!, slug: "variables-data-types-operators", title: "Programming Basics: Variables, Data Types, and Operators", summary: "Meet the three building blocks behind every program: places to store data, the kinds of data you can store, and the operators that let you work with it.", estimatedMinutes: 0, sortOrder: 0, youtubeID: "Y34DRfpkhNM"),
                        LessonSummary(id: UUID(uuidString: "e9d223cd-1f8d-4587-ae5a-d83d294abb9d")!, moduleID: UUID(uuidString: "90692a57-558a-4037-954d-8b71df1db139")!, slug: "control-flow-conditionals-loops-methods", title: "Control Flow: Conditionals, Loops, and Methods", summary: "Learn how programs make decisions, repeat work, and stay organized so your code reacts to the world instead of running blindly top to bottom.", estimatedMinutes: 0, sortOrder: 1, youtubeID: "vwYXaQUCJCU"),
                        LessonSummary(id: UUID(uuidString: "1a939325-d11b-43df-9de0-08178e15c001")!, moduleID: UUID(uuidString: "90692a57-558a-4037-954d-8b71df1db139")!, slug: "oop-classes-objects-inheritance", title: "Object-Oriented Java: Classes, Objects, and Inheritance", summary: "Discover how Java models the real world with classes and objects, and how inheritance lets you build on existing code instead of starting over.", estimatedMinutes: 0, sortOrder: 2, youtubeID: "Ho8cvpgvzGU"),
                        LessonSummary(id: UUID(uuidString: "81890427-5a72-40a7-a9f4-0ab8261b9ec5")!, moduleID: UUID(uuidString: "90692a57-558a-4037-954d-8b71df1db139")!, slug: "why-java-and-reading-wpilib", title: "Why Java for FRC and How to Read WPILib Code", summary: "See why Java is the most popular FRC language and learn to read a real WPILib robot file so the examples you'll meet all season stop looking like magic.", estimatedMinutes: 0, sortOrder: 3, youtubeID: "pWRH9IU7ASc"),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "8fe6592a-e11b-431b-a943-b8d518832591")!, departmentID: UUID(uuidString: "96b4f59a-938b-4896-8699-6236d75531a8")!, slug: "foundations-tools-and-first-program",
                    title: "Foundations: Tools, Languages, and Your First Robot Program",
                    overview: "Set up the full FRC software toolchain and understand the big picture. You will install WPILib and the Game Tools, learn which languages FRC supports, and write and deploy your first robot program to a roboRIO.",
                    sortOrder: 0, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "49fe42fe-c8c9-4081-aca2-1f432c6be577")!, moduleID: UUID(uuidString: "8fe6592a-e11b-431b-a943-b8d518832591")!, slug: "frc-software-stack", title: "The FRC Software Stack: What Runs Where", summary: "A map of the software pieces in an FRC robot — from your laptop to the roboRIO — and how they talk to each other.", estimatedMinutes: 30, sortOrder: 0, youtubeID: "twrqGBa4ao4"),
                        LessonSummary(id: UUID(uuidString: "7e1cae7d-a1d3-4313-91e8-5e87d729fb61")!, moduleID: UUID(uuidString: "8fe6592a-e11b-431b-a943-b8d518832591")!, slug: "choosing-a-language", title: "Choosing a Language: Java, C++, or Python", summary: "WPILib officially supports three text-based languages — Java, C++, and Python (RobotPy). Learn the tradeoffs and where LabVIEW fits today.", estimatedMinutes: 25, sortOrder: 1, youtubeID: "vJ_hnGQP3Hk"),
                        LessonSummary(id: UUID(uuidString: "b29fe617-a571-43ff-8956-0005bc28170f")!, moduleID: UUID(uuidString: "8fe6592a-e11b-431b-a943-b8d518832591")!, slug: "installing-the-toolchain", title: "Installing the Toolchain: WPILib, Game Tools, and Driver Station", summary: "Install WPILib (VS Code + extension) and the NI FRC Game Tools (Driver Station + roboRIO Imaging Tool), then image a roboRIO.", estimatedMinutes: 45, sortOrder: 2, youtubeID: "YeQF8qYJIRA"),
                        LessonSummary(id: UUID(uuidString: "4d0c535a-cc19-4a24-b828-1596ab526a3f")!, moduleID: UUID(uuidString: "8fe6592a-e11b-431b-a943-b8d518832591")!, slug: "vscode-and-deploying", title: "VS Code, the WPILib Extension, and Deploying Code", summary: "Create a project from a template, then build and deploy it to the roboRIO using the WPILib extension.", estimatedMinutes: 40, sortOrder: 3, youtubeID: "jJgCk9vGETM"),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "a8db7234-99eb-4ef7-bb73-2507157ae1cb")!, departmentID: UUID(uuidString: "96b4f59a-938b-4896-8699-6236d75531a8")!, slug: "robot-program-and-command-based",
                    title: "The Robot Program: Lifecycle and Command-Based Architecture",
                    overview: "Learn how a robot program is structured and runs. Start with TimedRobot's lifecycle, then adopt the command-based framework — the modern, recommended way to organize FRC code with Subsystems, Commands, and Triggers.",
                    sortOrder: 1, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "24c3e75d-3340-4d11-b462-f1cbbf730dd9")!, moduleID: UUID(uuidString: "a8db7234-99eb-4ef7-bb73-2507157ae1cb")!, slug: "timedrobot-lifecycle", title: "TimedRobot and the Robot Lifecycle", summary: "Understand the periodic loop that drives every robot program: init and periodic methods, robot modes, and the 20 ms (50 Hz) cycle.", estimatedMinutes: 35, sortOrder: 0, youtubeID: "3yadbNTmGB4"),
                        LessonSummary(id: UUID(uuidString: "e342b601-1bf5-4a1d-8795-3a408184b5f2")!, moduleID: UUID(uuidString: "a8db7234-99eb-4ef7-bb73-2507157ae1cb")!, slug: "command-based-subsystems", title: "Why Command-Based? Subsystems and the Scheduler", summary: "Adopt the modern command-based framework. Learn what subsystems are and how the command scheduler manages resources.", estimatedMinutes: 40, sortOrder: 1, youtubeID: "uRlZ9CUtPME"),
                        LessonSummary(id: UUID(uuidString: "db740820-9371-47de-b126-265ec9f4a26d")!, moduleID: UUID(uuidString: "a8db7234-99eb-4ef7-bb73-2507157ae1cb")!, slug: "writing-commands", title: "Writing Commands and Compositions", summary: "Create commands with lambdas and factory methods, then combine them into sequences and parallel groups.", estimatedMinutes: 45, sortOrder: 2, youtubeID: "Ao3PVfy9EyQ"),
                        LessonSummary(id: UUID(uuidString: "488a93b8-d57f-4772-8c8c-82f6e0f35946")!, moduleID: UUID(uuidString: "a8db7234-99eb-4ef7-bb73-2507157ae1cb")!, slug: "joysticks-and-triggers", title: "Reading Joysticks and Binding Triggers", summary: "Read gamepads with CommandXboxController and bind buttons to commands using Triggers (onTrue, whileTrue).", estimatedMinutes: 40, sortOrder: 3, youtubeID: nil),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "d679c394-fb75-4149-b838-b23da6d7f485")!, departmentID: UUID(uuidString: "96b4f59a-938b-4896-8699-6236d75531a8")!, slug: "motors-and-control",
                    title: "Motors, Sensors, and Closed-Loop Control",
                    overview: "Drive real hardware with vendor motor-controller APIs (CTRE Phoenix 6 and REVLib 2025), then make mechanisms precise with PID feedback, feedforward, and motion profiles.",
                    sortOrder: 2, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "30e42609-2f04-4003-a21a-a35c425b5931")!, moduleID: UUID(uuidString: "d679c394-fb75-4149-b838-b23da6d7f485")!, slug: "ctre-phoenix-6", title: "CTRE Phoenix 6: Talon FX, Kraken X60/X44, and Falcon 500", summary: "Control CTRE's Talon FX (which drives the Kraken X60, Kraken X44, and legacy Falcon 500) using the Phoenix 6 API: configuration objects and control requests.", estimatedMinutes: 45, sortOrder: 0, youtubeID: nil),
                        LessonSummary(id: UUID(uuidString: "b09e7cc3-3784-4c09-8fdf-7056c9007b9a")!, moduleID: UUID(uuidString: "d679c394-fb75-4149-b838-b23da6d7f485")!, slug: "revlib-spark", title: "REVLib: SPARK MAX / SPARK Flex with NEO and NEO Vortex", summary: "Control REV Robotics motors — the NEO and NEO Vortex via SPARK MAX / SPARK Flex — using the modern REVLib 2025 configuration API.", estimatedMinutes: 45, sortOrder: 1, youtubeID: nil),
                        LessonSummary(id: UUID(uuidString: "7477452d-6a2b-4232-8f70-61868824196a")!, moduleID: UUID(uuidString: "d679c394-fb75-4149-b838-b23da6d7f485")!, slug: "pid-control", title: "PID Feedback Control", summary: "Use PID controllers to drive a mechanism to a setpoint, and understand what each gain does.", estimatedMinutes: 40, sortOrder: 2, youtubeID: nil),
                        LessonSummary(id: UUID(uuidString: "f5ecff47-9dd1-4184-81c9-21787d002dbf")!, moduleID: UUID(uuidString: "d679c394-fb75-4149-b838-b23da6d7f485")!, slug: "feedforward-and-motion-profiling", title: "Feedforward and Motion Profiling", summary: "Add feedforward to predict required output, and use trapezoid motion profiles for smooth, fast moves.", estimatedMinutes: 45, sortOrder: 3, youtubeID: nil),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "26db6e40-bbf4-4255-9a38-da36cbe8bbee")!, departmentID: UUID(uuidString: "96b4f59a-938b-4896-8699-6236d75531a8")!, slug: "autonomous-trajectories-simulation",
                    title: "Autonomous: Odometry, Trajectories, and Simulation",
                    overview: "Make the robot navigate the field on its own. Track position with odometry, generate and follow paths with PathPlanner and Choreo, build full autonomous routines, and test everything in simulation before touching hardware.",
                    sortOrder: 3, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "8a35c512-5a57-4e70-973c-739e1fd64680")!, moduleID: UUID(uuidString: "26db6e40-bbf4-4255-9a38-da36cbe8bbee")!, slug: "kinematics-and-odometry", title: "Kinematics and Odometry: Knowing Where You Are", summary: "Convert wheel motion to robot motion with kinematics, and track the robot's field position over time with odometry.", estimatedMinutes: 45, sortOrder: 0, youtubeID: nil),
                        LessonSummary(id: UUID(uuidString: "2cebd644-0134-447e-9e40-f1c4d6ceec2d")!, moduleID: UUID(uuidString: "26db6e40-bbf4-4255-9a38-da36cbe8bbee")!, slug: "trajectories-pathplanner-choreo", title: "Trajectories with PathPlanner and Choreo", summary: "Design smooth driving paths visually with PathPlanner or Choreo, then follow them in code.", estimatedMinutes: 50, sortOrder: 1, youtubeID: nil),
                        LessonSummary(id: UUID(uuidString: "075d3c3b-2f6f-4fe3-ab63-9cd02809eb2c")!, moduleID: UUID(uuidString: "26db6e40-bbf4-4255-9a38-da36cbe8bbee")!, slug: "building-autonomous-routines", title: "Building Autonomous Routines", summary: "Assemble paths, mechanism actions, and a dashboard selector into complete autonomous modes.", estimatedMinutes: 40, sortOrder: 2, youtubeID: nil),
                        LessonSummary(id: UUID(uuidString: "c37a43ac-4d6b-4a2b-829c-550e2fab8618")!, moduleID: UUID(uuidString: "26db6e40-bbf4-4255-9a38-da36cbe8bbee")!, slug: "simulation", title: "Simulation: Test Without a Robot", summary: "Run robot code on your laptop with the WPILib Simulation GUI to debug logic, virtual joysticks, and field position before deploying.", estimatedMinutes: 40, sortOrder: 3, youtubeID: nil),
                    ]
                ),
            ]
        ),
        Department(
            id: UUID(uuidString: "b30aa2fb-8518-4c38-bf69-c58864c3177c")!,
            slug: "business-operations",
            name: "Business, Operations & Fundraising",
            tagline: "Run your team — and fund it — like a real organization.",
            description: "The Business & Operations branch covers everything that keeps an FRC team running as an organization rather than just a robot project: team structure and student leadership, project management across the build season, budgeting and fundraising, sustainability and recruitment, documentation, and the team business plan. It also covers how the business sub-team supports the technical sub-teams year-round and how all of this culminates in the FIRST Impact Award, the program's most prestigious honor and the only path to the FIRST Hall of Fame. This is the work that turns a one-season robot into a multi-decade institution.",
            difficulty: "All Levels",
            estimatedHours: 16,
            whatYoullLearn: ["How to structure an FRC team with student leadership, sub-teams, and adult mentors", "How to plan and manage the build season using Gantt charts and Kanban boards", "How to build a realistic team budget and fundraise through grants and sponsorships", "How to recruit and retain members and build a sustainable, multi-year program", "How to document team activities and write a compelling business plan"],
            prerequisites: ["A general understanding of what FIRST Robotics Competition (FRC) is", "No technical/engineering background required", "Access to a team or a desire to start one"],
            tools: ["Trello / Kanban boards", "Gantt charts (Google Sheets, Microsoft Project, TeamGantt)", "Google Workspace (Docs, Sheets, Drive)", "Slack / Discord for team communication", "The Blue Alliance"],
            sources: [SourceLink(title: "FIRST Robotics Competition Cost and Registration", url: URL(string: "https://www.firstinspires.org/robotics/frc/cost-and-registration")!), SourceLink(title: "FIRST Impact Award Resources", url: URL(string: "https://www.firstinspires.org/resources/library/frc/fia-resources")!), SourceLink(title: "FIRST Impact Award Definitions (Rev. Jan 2026)", url: URL(string: "https://info.firstinspires.org/hubfs/web/program/frc/awards/fia-definitions.pdf")!)],
            icon: "Briefcase",
            sortOrder: 5,
            modules: [
                Module(
                    id: UUID(uuidString: "5d025978-0d99-442a-98b0-03b120f75f9d")!, departmentID: UUID(uuidString: "b30aa2fb-8518-4c38-bf69-c58864c3177c")!, slug: "prerequisites",
                    title: "Foundations: Nonprofits, Budgets, and Teams",
                    overview: "A start-here primer on the organizational and financial basics every FRC team needs off the field. Before you fundraise, file paperwork, or run a build season, learn what a nonprofit actually is, how to build a budget that survives a six-week sprint, and how to manage a project with a real deadline. Each lesson teaches the concept from scratch, then ties it directly to how FRC teams operate.",
                    sortOrder: -1, isPrerequisite: true,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "c230be7a-d4a2-489b-87f7-f2424953114c")!, moduleID: UUID(uuidString: "5d025978-0d99-442a-98b0-03b120f75f9d")!, slug: "what-a-nonprofit-is-501c3-basics", title: "What a Nonprofit Is (and 501(c)(3) Basics)", summary: "Discover what it really means to be a nonprofit and why 501(c)(3) status is the financial backbone of most FRC teams.", estimatedMinutes: 0, sortOrder: 0, youtubeID: "tpUQJkwUhRU"),
                        LessonSummary(id: UUID(uuidString: "30b3984d-1085-4ac8-a419-d137ec0b9821")!, moduleID: UUID(uuidString: "5d025978-0d99-442a-98b0-03b120f75f9d")!, slug: "budgeting-101-income-expenses-cash-flow", title: "Budgeting 101: Income, Expenses, and Cash Flow", summary: "Learn to build a budget that survives a six-week build season — where the money comes from, where it goes, and why timing can sink a team that's technically \"in the black.\"", estimatedMinutes: 0, sortOrder: 1, youtubeID: "Ek6cehqBO-8"),
                        LessonSummary(id: UUID(uuidString: "c58162b3-930e-4d2b-9fb1-1e023005f252")!, moduleID: UUID(uuidString: "5d025978-0d99-442a-98b0-03b120f75f9d")!, slug: "project-management-and-working-in-teams", title: "Project Management and Working in Teams", summary: "See how the same planning tools that run billion-dollar projects help your team turn a blank Kickoff into a competition-ready robot in six weeks.", estimatedMinutes: 0, sortOrder: 2, youtubeID: "meI_tza01cM"),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "c45d0bb6-9b59-4414-a678-59f7e3ec741f")!, departmentID: UUID(uuidString: "b30aa2fb-8518-4c38-bf69-c58864c3177c")!, slug: "team-structure-and-leadership",
                    title: "Team Structure & Leadership",
                    overview: "Learn how FRC teams organize themselves into sub-teams led by students and supported by mentors. This module covers leadership roles, the place of the business sub-team in the org chart, and the official adult roles FIRST requires.",
                    sortOrder: 0, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "75d8b94f-5316-4271-bd54-2aa92cbcfd9c")!, moduleID: UUID(uuidString: "c45d0bb6-9b59-4414-a678-59f7e3ec741f")!, slug: "what-an-frc-team-is", title: "What an FRC Team Actually Is", summary: "Understand that an FRC team is a small nonprofit-style organization, not just a group that builds a robot, and why structure matters.", estimatedMinutes: 25, sortOrder: 0, youtubeID: "0GGFU19PDf4"),
                        LessonSummary(id: UUID(uuidString: "8fa0991e-b8d2-428d-ad7e-1fc6d1bcadd1")!, moduleID: UUID(uuidString: "c45d0bb6-9b59-4414-a678-59f7e3ec741f")!, slug: "sub-teams-and-org-chart", title: "Sub-Teams and the Org Chart", summary: "Map out the common sub-teams on an FRC team and see where business and operations fits in the overall organization.", estimatedMinutes: 25, sortOrder: 1, youtubeID: "vCAqTXPAOmY"),
                        LessonSummary(id: UUID(uuidString: "5cbc59b3-196f-46f2-8dd7-7c6be78b9874")!, moduleID: UUID(uuidString: "c45d0bb6-9b59-4414-a678-59f7e3ec741f")!, slug: "student-leadership-and-mentors", title: "Student Leadership and Mentors", summary: "Learn the difference between student leadership and mentorship, common leadership roles, and how to build a leadership pipeline.", estimatedMinutes: 25, sortOrder: 2, youtubeID: "s0WWXN-WEAc"),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "27ddcd4a-3e67-42a3-adde-4a896dab984a")!, departmentID: UUID(uuidString: "b30aa2fb-8518-4c38-bf69-c58864c3177c")!, slug: "budgeting-finance-fundraising",
                    title: "Budgeting, Finance & Fundraising",
                    overview: "Robots cost real money. This module covers what an FRC team actually spends, how to build a budget, and how to fund it through sponsorships and grants like NASA and Gene Haas.",
                    sortOrder: 2, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "ab445757-af1c-4754-b0e4-cf3fba75e6ee")!, moduleID: UUID(uuidString: "27ddcd4a-3e67-42a3-adde-4a896dab984a")!, slug: "what-an-frc-team-costs", title: "What an FRC Team Costs", summary: "Learn the real costs of running an FRC team, from the registration fee to events, parts, and travel.", estimatedMinutes: 25, sortOrder: 0, youtubeID: "IMWC3SgIKjY"),
                        LessonSummary(id: UUID(uuidString: "18057df4-7c67-41e3-ac62-34706f38db6b")!, moduleID: UUID(uuidString: "27ddcd4a-3e67-42a3-adde-4a896dab984a")!, slug: "building-managing-a-budget", title: "Building and Managing a Budget", summary: "Create a working team budget, track spending against it, and keep clean financial records.", estimatedMinutes: 25, sortOrder: 1, youtubeID: "KzizfoBl1_w"),
                        LessonSummary(id: UUID(uuidString: "52887c79-61da-4c6b-baab-a90e30d5ec69")!, moduleID: UUID(uuidString: "27ddcd4a-3e67-42a3-adde-4a896dab984a")!, slug: "sponsorships-and-grants", title: "Sponsorships and Grants", summary: "Learn how to fund your team through corporate sponsorships and the major FRC grant programs from FIRST and partners like NASA and Gene Haas.", estimatedMinutes: 30, sortOrder: 2, youtubeID: "u_pgBGYAdKo"),
                    ]
                ),
                Module(
                    id: UUID(uuidString: "0e926e3c-c694-44db-9e4b-6558056ce9d3")!, departmentID: UUID(uuidString: "b30aa2fb-8518-4c38-bf69-c58864c3177c")!, slug: "understanding-the-cost",
                    title: "Understanding the Cost of an FRC Team",
                    overview: "Before you can raise money, you need to know exactly what you are raising it for. This module breaks down every line item in a realistic FRC budget and explains the Regional vs District cost structures.",
                    sortOrder: 5, isPrerequisite: false,
                    lessons: [
                        LessonSummary(id: UUID(uuidString: "d83e1d25-61d6-439f-93d7-b0402ac39b74")!, moduleID: UUID(uuidString: "0e926e3c-c694-44db-9e4b-6558056ce9d3")!, slug: "what-frc-actually-costs", title: "What FRC Actually Costs: The Big Picture", summary: "An honest accounting of a first-year and ongoing FRC budget, from registration to championship travel.", estimatedMinutes: 25, sortOrder: 0, youtubeID: "jdGy4OUM2EY"),
                        LessonSummary(id: UUID(uuidString: "2fd8a593-eb0a-4398-9fe6-d539ac5e6f56")!, moduleID: UUID(uuidString: "0e926e3c-c694-44db-9e4b-6558056ce9d3")!, slug: "registration-and-event-fees", title: "Registration & Event Fees in Detail", summary: "How season registration, additional events, and the FIRST Dashboard timeline actually work.", estimatedMinutes: 20, sortOrder: 1, youtubeID: "mjinKUVKqMk"),
                        LessonSummary(id: UUID(uuidString: "2b07e21f-f308-4aad-8dfd-b69f0ebcf47c")!, moduleID: UUID(uuidString: "0e926e3c-c694-44db-9e4b-6558056ce9d3")!, slug: "regional-vs-district-cost", title: "Regional vs District: How Your Region Changes the Math", summary: "The two FRC competition models cost very different amounts; know which one you are in.", estimatedMinutes: 18, sortOrder: 2, youtubeID: "0OoTINMK338"),
                    ]
                ),
            ]
        ),
    ]

    /// A business lesson with a GFM table and a video.
    static let budgetLessonBody = LessonBody(
        id: UUID(uuidString: "d83e1d25-61d6-439f-93d7-b0402ac39b74")!,
        content: #"""
## FRC is expensive, and that is the point of this branch

FIRST Robotics Competition is one of the most resource-intensive student activities in the world. A brand-new team should plan for **roughly $18,000 to $25,000+ in its first year**, and established teams commonly run **$30,000 to $60,000+** annual budgets depending on how many events they attend and how far they travel. (FRC Team 533, for example, publishes an annual budget of about $55,000.) Knowing these numbers cold is the foundation of every fundraising conversation you will ever have.

## The major cost categories

- **Season registration** - The single largest fixed cost. For the 2026-2027 season, FIRST set base season registration at **$6,500** (a $200 increase over the prior year). This buys your team number (for new teams), the Kit of Parts (Kickoff Kit, Virtual Kit, and FIRST Choice credits), and participation in your first event. Note that some regions add local event-production fees on top of this base number, so your all-in cost can be higher.
- **Additional events** - Each additional Regional event is **$3,200**. District teams get two District events bundled into their season registration; additional district events and the District Championship are priced by the district organization.
- **Robot materials and tools** - Motors, control system, pneumatics, raw aluminum, COTS mechanisms, batteries, and consumables. Budget **$3,000-$8,000+**, more in year one when you are buying tools and a control system from scratch.
- **Travel** - Transportation, hotels, and meals for events. This is the most variable line: a local district event might cost a few hundred dollars, while flying a team to the FIRST Championship (held at the George R. Brown Convention Center in Houston) can cost **$15,000-$40,000**.
- **Team operations** - T-shirts, safety gear (ANSI Z87.1 safety glasses are mandatory in the pits), spirit items, outreach materials, software, and a practice space.

## Build the budget first

Create a line-item spreadsheet before you ask anyone for a dollar. Sponsors and grant reviewers expect to see a real budget, and FRC's top awards (the FIRST Impact Award and the Team Sustainability Award) reward teams that demonstrate a sustainable, well-run program. A credible budget is the difference between 'we need money for robots' and 'we need $6,500 to register and $4,000 for our control system.'

## A sample first-year budget

| Line item | Estimate |
|---|---|
| Season registration | $6,500 |
| One additional regional | $3,200 |
| Control system + motors | $3,500 |
| Robot raw materials/COTS | $2,500 |
| Tools & safety equipment | $2,000 |
| Travel (local/regional) | $2,500 |
| T-shirts & team operations | $1,500 |
| **Total** | **~$21,700** |

Your numbers will differ, but the discipline is the same: every fundraising target should trace back to a real expense.
"""#,
        keyTakeaways: ["A first-year FRC team should plan for roughly $18,000-$25,000+; established teams often run $30,000-$60,000+", "2026-2027 base season registration is $6,500 and each additional Regional event is $3,200", "Build a detailed line-item budget before asking anyone for money, because funders expect it"],
        resources: [SourceLink(title: "FIRST - Cost & Registration", url: URL(string: "https://www.firstinspires.org/robotics/frc/cost-and-registration")!), SourceLink(title: "2025-2026 FIRST Program Registration Pricing (FIRST Community Blog)", url: URL(string: "https://community.firstinspires.org/2025-2026-first-program-registration-pricing")!), SourceLink(title: "FRC Team 533 Yearly Budget example", url: URL(string: "https://www.team533.com/financial/yearly-budget")!)],
        quiz: [
            QuizQuestion(question: "What is the base season registration fee FIRST set for the 2026-2027 season?", options: ["FIRST set base season registration for 2026-2027 at $3,200", "Season registration for 2026-2027 was cut to about $2,500", "FIRST set base season registration for 2026-2027 at $6,500", "The 2026-2027 base season registration climbed past $18,000"], answer: 2, explanation: "The lesson states FIRST set base season registration at $6,500 for 2026-2027, a $200 increase over the prior year, and that this is the single largest fixed cost."),
            QuizQuestion(question: "How much does each additional Regional event cost a team beyond its season registration?", options: ["Each additional Regional event costs a flat $3,200 to enter", "Extra Regional events are bundled into base registration free", "Additional Regional events are billed at $6,500 apiece total", "Extra Regional events cost the same as a Championship trip run"], answer: 0, explanation: "The lesson lists each additional Regional event at $3,200; only District teams get two District events bundled into their registration, not extra Regionals."),
            QuizQuestion(question: "Why is travel the most variable line item in an FRC budget?", options: ["FIRST fully covers Championship travel for qualifying teams", "Championship travel is capped near a few hundred dollars total", "Championship attendance is included in the season registration", "Flying a team to the FIRST Championship can run $15,000-$40,000"], answer: 3, explanation: "The lesson calls travel the most variable line: a local district event might cost a few hundred dollars, while flying a team to the FIRST Championship in Houston can cost $15,000-$40,000."),
        ],
        youtubeID: "jdGy4OUM2EY"
    )

    /// A programming lesson with fenced Java code and no video.
    static let codeLessonBody = LessonBody(
        id: UUID(uuidString: "075d3c3b-2f6f-4fe3-ab63-9cd02809eb2c")!,
        content: #"""
## What autonomous needs

The first ~15 seconds of an FRC match are **autonomous**: the robot runs with no driver input. A good auto combines **driving** (trajectories) with **mechanism actions** (intake, score) and finishes reliably. In command-based code, an entire auto is just one big composed command.

## Returning the auto command

In the command-based template, `Robot.autonomousInit()` schedules whatever `RobotContainer.getAutonomousCommand()` returns:

```java
public Command getAutonomousCommand() {
  return Commands.sequence(
      drivetrain.followPath("ToReef"),   // a trajectory
      arm.raiseToScore(),                 // mechanism action
      intake.eject().withTimeout(1.0),    // score
      drivetrain.followPath("BackToStart"));
}
```

Sequences run steps in order; parallel groups let you, say, raise the arm *while* driving to save time:

```java
Commands.deadline(
    drivetrain.followPath("ToReef"),  // deadline: ends when the drive ends
    arm.raiseToScore());              // runs alongside
```

## Letting drivers pick the auto

Matches need different autos depending on alliance strategy and starting position. Use a **`SendableChooser`** to expose options on the dashboard (Elastic, Glass, or Shuffleboard):

```java
private final SendableChooser<Command> m_chooser = new SendableChooser<>();

public RobotContainer() {
  m_chooser.setDefaultOption("Score + Leave", scoreAndLeaveAuto());
  m_chooser.addOption("Just Leave", justLeaveAuto());
  SmartDashboard.putData("Auto", m_chooser);
}

public Command getAutonomousCommand() { return m_chooser.getSelected(); }
```

If you're using PathPlanner, `AutoBuilder.buildAutoChooser()` can populate a chooser with every auto you built in the GUI automatically. With ChoreoLib, prefer its `AutoChooser`.

## Reliability beats ambition

A few hard-won principles:

- **Add timeouts.** Wrap risky commands with `.withTimeout(...)` so a stuck mechanism can't hang the whole auto.
- **Set the starting pose.** Reset odometry to the path's start pose in the auto's first step, or your trajectory follower starts from a wrong belief about position. (PathPlanner/Choreo helpers can do this for you.)
- **Test the exact starting position** you'll use on the field; a few centimeters of offset compounds over a path.
- **Prefer a simple auto that always works** over a complex one that sometimes fails. A reliable "score one and leave" outscores an ambitious auto that no-shows half the time.

## Putting it together

A complete auto module typically: resets odometry → follows a path (optionally doing mechanism work in parallel) → scores → repositions. Wired to a chooser and tested in simulation (next lesson) and on the practice field, this is what separates teams that reliably bank autonomous points from those that gamble on them.
"""#,
        keyTakeaways: ["Autonomous is one composed command returned from getAutonomousCommand().", "Use sequences for ordered steps and parallel/deadline groups to save time.", "Expose multiple autos with SendableChooser (or PathPlanner/Choreo choosers) on the dashboard.", "Reset odometry to the path's start pose and add timeouts to risky commands.", "A simple, reliable auto beats a complex one that fails — and always test the exact start position."],
        resources: [SourceLink(title: "Organizing Command-Based Robot Projects", url: URL(string: "https://docs.wpilib.org/en/stable/docs/software/commandbased/organizing-command-based.html")!), SourceLink(title: "PathPlanner: Build an Auto", url: URL(string: "https://pathplanner.dev/pplib-build-an-auto.html")!), SourceLink(title: "ChoreoLib AutoFactory", url: URL(string: "https://choreo.autos/choreolib/auto-factory/")!)],
        quiz: [
            QuizQuestion(question: "In WPILib's command-based framework, which command group runs its commands one after another in order?", options: ["ParallelCommandGroup", "ParallelRaceGroup", "SequentialCommandGroup", "ParallelDeadlineGroup"], answer: 2, explanation: "A SequentialCommandGroup executes its commands one at a time in order, starting the next only after the previous one finishes; the parallel groups instead run commands concurrently, as the lesson shows with Commands.sequence for an ordered auto."),
            QuizQuestion(question: "What is the standard WPILib tool for letting drivers pick which autonomous routine runs from the dashboard?", options: ["A SendableChooser built in RobotContainer and put on the dashboard", "The DifferentialDriveOdometry class sampled at the auto period onset", "A ParallelRaceGroup racing every possible auto command all together", "A hard-coded if/else chain evaluated inside robotInit at startup time"], answer: 0, explanation: "The lesson uses a SendableChooser populated in RobotContainer and exposed on the dashboard; getAutonomousCommand() returns m_chooser.getSelected() so the driver's picked auto is scheduled when autonomous begins."),
            QuizQuestion(question: "A ParallelDeadlineGroup ends when which condition is met?", options: ["As soon as any single command in the group happens to finish first", "Once the single designated deadline command in the group finishes", "Only after every last command in the group has finished running", "When the human driver presses the configured button on the controller"], answer: 1, explanation: "The lesson's deadline example ends when the drive path (the deadline command) ends, cancelling the arm command running alongside; a ParallelDeadlineGroup finishes as soon as its one designated deadline command completes."),
        ],
        youtubeID: nil
    )

    /// A lesson with numbered lists, inline code and a blockquote callout (bold lead).
    static let calloutLessonBody = LessonBody(
        id: UUID(uuidString: "4d0c535a-cc19-4a24-b828-1596ab526a3f")!,
        content: #"""
## The WPILib command palette

Everything FRC-specific in VS Code lives behind the red **"W" icon** in the top-right corner (or press **Ctrl+Shift+P** and type "WPILib"). This opens the WPILib command palette.

## Creating a new project

1. Open the command palette → **"Create a new project."**
2. Choose a **project type**: *Template* (bare base classes) or *Example* (working sample code). Importing an existing Gradle project is a separate command, not a choice here.
3. Choose your **language** (Java/C++).
4. Pick a **base class** — for beginners, start with **TimedRobot** or the **Command Robot** template. (The "TimedRobot Skeleton" variant strips out comments and the autonomous example, so WPILib recommends it once you're already familiar with TimedRobot, not as a first project.)
5. Set a folder, project name, and your **team number**.

The extension generates a Gradle project: source under `src/main/java/...`, a `build.gradle`, and a `vendordeps/` folder for vendor libraries.

## Building robot code

Use the command palette → **"Build Robot Code"** (or the shortcut menu in the top-right). Gradle compiles your code and reports errors. Building does **not** require a robot — you can build anywhere. Always build before a competition to catch compile errors early.

## Deploying to the roboRIO

With the roboRIO powered and connected (USB, Ethernet, or robot radio), use **"Deploy Robot Code."** This:

1. Builds the code if needed.
2. Copies the program to the roboRIO.
3. Restarts the robot program so your new code runs.

The Deploy console (the RioLog) shows progress and runtime `System.out` / print output, which is your first-line debugging tool.

> **Critical warning:** Never power off the robot while deploying. Interrupting a deploy can corrupt the roboRIO filesystem, forcing a re-image.

## Vendor libraries (vendordeps)

Motor-controller vendors ship their own libraries (CTRE Phoenix 6, REVLib, PathPlannerLib, ChoreoLib, etc.). Install them via the command palette → **"Manage Vendor Libraries" → "Install new libraries (online)"** and paste the vendor's JSON URL, or "offline" if the installer placed them locally. Each adds a file in `vendordeps/`. You'll do this in Module 3.

## A typical first session

1. Create a **Command Robot** project with your team number.
2. Build it (should succeed with no edits).
3. Connect to the roboRIO and deploy.
4. Open the Driver Station, enable **Teleop**, and confirm the program is running (the Driver Station shows "Communications," "Robot Code," and "Joysticks" indicators green).

If all three indicators are green, your toolchain is fully working and you're ready to write real code.
"""#,
        keyTakeaways: ["The red 'W' icon opens all WPILib commands in VS Code.", "Create projects from Template or Example; Command Robot is a great starting point.", "Build works anywhere; Deploy requires a connected roboRIO and restarts the robot program.", "Never power off during a deploy — it can corrupt the roboRIO.", "Vendor libraries are added through 'Manage Vendor Libraries' and land in vendordeps/."],
        resources: [SourceLink(title: "VS Code Basics and the WPILib Extension", url: URL(string: "https://docs.wpilib.org/en/stable/docs/software/vscode-overview/vscode-basics.html")!), SourceLink(title: "Building and Deploying Robot Code", url: URL(string: "https://docs.wpilib.org/en/stable/docs/software/vscode-overview/deploying-robot-code.html")!), SourceLink(title: "3rd Party (Vendor) Libraries", url: URL(string: "https://docs.wpilib.org/en/stable/docs/software/vscode-overview/3rd-party-libraries.html")!)],
        quiz: [
            QuizQuestion(question: "What is the standard way to run WPILib commands inside VS Code?", options: ["Type the full command name into the VS Code integrated terminal as a shell command", "Edit the build.gradle file by hand and save it to trigger the WPILib command to run", "Click the red 'W' icon, or press Ctrl+Shift+P and type 'WPILib' to open it", "Open the Run and Debug panel with F5 and pick the command from the launch menu list"], answer: 2, explanation: "Everything FRC-specific lives behind the red 'W' icon in the top-right; you can also press Ctrl+Shift+P and type 'WPILib' to open the same command palette."),
            QuizQuestion(question: "Which command builds your project and sends the compiled program to the roboRIO?", options: ["WPILib: Build Robot Code, which compiles the sources locally without a roboRIO", "WPILib: Deploy Robot Code, which builds and copies the program to the roboRIO", "WPILib: Simulate Robot Code, which runs the built program in a local simulator", "WPILib: Start Tool, which opens the RioLog console to stream the program output"], answer: 1, explanation: "'Deploy Robot Code' builds the code if needed, copies it to the roboRIO, and restarts the robot program, whereas 'Build Robot Code' only compiles."),
            QuizQuestion(question: "What happens if you power off the robot in the middle of a deploy?", options: ["It restarts the running robot program so your newly deployed code takes effect", "It copies the freshly built robot program from your computer onto the roboRIO", "It builds the robot code first if the current sources have not been compiled", "It can corrupt the roboRIO filesystem, which may force you to fully re-image it"], answer: 3, explanation: "The lesson's critical warning states that interrupting a deploy can corrupt the roboRIO filesystem, forcing a re-image; the other options describe normal steps of a successful deploy."),
        ],
        youtubeID: "jJgCk9vGETM"
    )

    /// Fenced code and a table in one lesson.
    static let codeAndTableLessonBody = LessonBody(
        id: UUID(uuidString: "b09e7cc3-3784-4c09-8fdf-7056c9007b9a")!,
        content: #"""
## The REV ecosystem

**REV Robotics** makes the **NEO** and **NEO Vortex** brushless motors, driven by the **SPARK MAX** and **SPARK Flex** motor controllers. Unlike the Talon FX, the controller and motor are *separate* (you wire a SPARK MAX to a NEO). They run on CAN and use the **REVLib** software library and the **REV Hardware Client** desktop app.

Install REVLib via "Manage Vendor Libraries" using REV's vendordep URL.

## The 2025 configuration model

Starting with **REVLib 2025**, all SPARK classes moved into a `com.revrobotics.spark` package and configuration became **declarative** (similar in spirit to Phoenix 6). Instead of calling setters directly on the controller, you build a **`SparkMaxConfig`** (or `SparkFlexConfig`) and apply it:

```java
import com.revrobotics.spark.SparkMax;
import com.revrobotics.spark.SparkBase;
import com.revrobotics.spark.SparkLowLevel.MotorType;
import com.revrobotics.spark.config.SparkMaxConfig;
import com.revrobotics.spark.config.SparkBaseConfig.IdleMode;

SparkMax motor = new SparkMax(2, MotorType.kBrushless); // CAN ID 2, NEO

SparkMaxConfig config = new SparkMaxConfig();
config.idleMode(IdleMode.kBrake);
config.smartCurrentLimit(40);

motor.configure(config,
    SparkBase.ResetMode.kResetSafeParameters,
    SparkBase.PersistMode.kPersistParameters);
```

`ResetMode`/`PersistMode` control whether old settings are wiped and whether the config survives a power cycle.

## Open-loop control

The simplest output is percent power:

```java
motor.set(0.5); // 50% output
```

## Closed-loop control

Configure PID gains under the config's **`closedLoop`** member, then command the on-board controller through **`getClosedLoopController()`**. In REVLib 2025 the controller class was renamed from `SparkPIDController` to **`SparkClosedLoopController`**, and you command it with **`setReference(value, ControlType)`** (as of REVLib 2026 `setReference(...)` is deprecated in favor of an identical **`setSetpoint(...)`**, so use that on the 2026 library):

```java
config.closedLoop
    .feedbackSensor(FeedbackSensor.kPrimaryEncoder)
    .pid(0.1, 0.0, 0.0);
motor.configure(config, ResetMode.kResetSafeParameters, PersistMode.kPersistParameters);

// Run on-board velocity control to 1000 RPM
motor.getClosedLoopController().setReference(1000, ControlType.kVelocity);
```

REV's on-board smooth-motion feature is **MAXMotion** (configured under `closedLoop.maxMotion` with parameters like cruise velocity and max acceleration), commanded with control types such as `kMAXMotionPositionControl`.

## Reading the encoder

The NEO/NEO Vortex have built-in encoders read through the SPARK:

```java
RelativeEncoder enc = motor.getEncoder();
double position = enc.getPosition(); // rotations
double velocity = enc.getVelocity(); // RPM
```

In REVLib 2025, read-back parameter getters live on a **`configAccessor`** field rather than on the controller directly.

## REV Hardware Client

Use the **REV Hardware Client** to set CAN IDs, update firmware, and test motors on the bench. As with CTRE, every device on the CAN bus needs a unique ID.

## CTRE vs. REV at a glance

| | CTRE Talon FX | REV SPARK MAX/Flex |
|---|---|---|
| Motor | Kraken X60/X44 / Falcon 500 (integrated) | NEO / NEO Vortex (separate) |
| Library | Phoenix 6 | REVLib |
| Config | TalonFXConfiguration + apply | SparkMaxConfig + configure |
| Command | setControl(request) | set() / getClosedLoopController().setReference() |

Many teams mix both. The patterns rhyme: configure declaratively, then either set open-loop output or command the on-board closed-loop controller.
"""#,
        keyTakeaways: ["REV's NEO / NEO Vortex motors are driven by separate SPARK MAX / SPARK Flex controllers.", "REVLib 2025 uses declarative config: build SparkMaxConfig, then motor.configure(...).", "Open-loop is motor.set(value); closed-loop uses getClosedLoopController().setSetpoint() (setReference is deprecated).", "Configure PID under config.closedLoop; MAXMotion provides on-board smooth motion.", "Use the REV Hardware Client to set unique CAN IDs and update firmware."],
        resources: [SourceLink(title: "REVLib Documentation", url: URL(string: "https://docs.revrobotics.com/revlib")!), SourceLink(title: "Migrating to REVLib 2025", url: URL(string: "https://docs.revrobotics.com/revlib/24-to-25")!), SourceLink(title: "SparkClosedLoopController API", url: URL(string: "https://codedocs.revrobotics.com/java/com/revrobotics/spark/sparkclosedloopcontroller")!)],
        quiz: [
            QuizQuestion(question: "In the REVLib 2025 configuration model, how do you set up a SPARK MAX?", options: ["Call the individual setter methods right on the SparkMax controller object", "Edit an XML profile file that the SPARK reads automatically at each power boot", "Build a SparkMaxConfig, set its fields, then call motor.configure() on it", "Wire each parameter through the roboRIO PWM port before every match begins"], answer: 2, explanation: "REVLib 2025 made configuration declarative: you build a SparkMaxConfig (or SparkFlexConfig), set fields like idleMode and smartCurrentLimit, then apply it with motor.configure(...)."),
            QuizQuestion(question: "How are REV's motors and controllers packaged compared to the CTRE Talon FX?", options: ["The SPARK and the NEO ship fused as one integrated unit, like the Talon FX", "The SPARK MAX or SPARK Flex is a separate controller wired to the NEO motor", "The NEO motor plugs straight into a roboRIO PWM header with no controller", "The controller sits inside the roboRIO itself and the NEO talks over CAN bus"], answer: 1, explanation: "Unlike the Talon FX where controller and motor are integrated, REV keeps them separate: you wire a SPARK MAX (or SPARK Flex) to a NEO (or NEO Vortex)."),
            QuizQuestion(question: "How do you command the SPARK's on-board closed-loop controller to a velocity target?", options: ["Send a raw voltage packet over CAN to the controller each robot loop cycle", "Toggle a digital output pin on the roboRIO that the SPARK reads as a target", "Pass the target straight into motor.set() using a value between zero and one", "Use getClosedLoopController().setReference() with a value and a ControlType"], answer: 3, explanation: "After configuring PID under config.closedLoop, you command the on-board controller via getClosedLoopController().setReference(value, ControlType) (renamed setSetpoint in REVLib 2026)."),
        ],
        youtubeID: nil
    )

    /// One of the two fact-checked lessons (verifiedAt set).
    static let verifiedLessonBody = LessonBody(
        id: UUID(uuidString: "ae85a782-97d4-4bb7-af56-fe73906e217a")!,
        content: #"""
Robot code has to **remember things** (a sensor reading, a motor output, whether a button is pressed) and **do math or comparisons** with them. Variables, data types, and operators are how you do both. Everything else in WPILib is built on top of these.

## Variables: Named Boxes for Data

A **variable** is a named box that holds a value. In Java you say what *kind* of value it holds when you create it:

```java
int motorPort = 3;
double speed = 0.75;
boolean isEnabled = true;
```

The pattern is always `type name = value;`. Creating the box is **declaring**; putting a value in is **assigning**. After that, reuse the name without the type:

```java
speed = 0.5;
```

Name variables for what they hold — `armAngle`, not `x`. Java convention is **camelCase**.

## Data Types: What Kind of Value?

Java checks every variable's type before the program runs, so a typo like assigning text to a number won't compile instead of crashing mid-match. The four types you'll use constantly in FRC:

- **`int`** — a whole number, e.g. a CAN ID or PWM port like `3`, or a counter.
- **`double`** — a decimal number, e.g. a motor output `0.75` or a distance in meters.
- **`boolean`** — only `true` or `false`: "is the limit switch pressed?"
- **`String`** — text like `"intake"`. It's an object, not a primitive, which is why it's capitalized.

`byte`, `short`, `long`, `float`, and `char` exist too, but you'll rarely reach for them as a beginner.

**This matters in FRC:** WPILib motor outputs are doubles from `-1.0` (full reverse) to `1.0` (full forward). Store one in an `int` and you throw away the decimal — your robot only ever stops or slams to full speed.

## Operators

1. **Arithmetic:** `+ - * / %` (`%` is remainder). Trap: `int / int` truncates, so `5 / 2` is `2`. Make one side a double (`5.0 / 2`) to get `2.5` — easy to hit when converting encoder ticks to distance.
2. **Comparison:** `==`, `!=`, `<`, `>`, `<=`, `>=` — each produces a `boolean`.
3. **Logical:** `&&` (and), `||` (or), `!` (not), e.g. `isEnabled && !isStopped`.
4. **Assignment shortcuts:** `count += 1;` is the same as `count = count + 1;`.

The classic beginner bug: `=` **assigns**, `==` **compares**. `if (ready = true)` is wrong; write `if (ready)`.

## Putting It Together

```java
double batteryVoltage = 12.4;
boolean lowBattery = batteryVoltage < 11.5;        // false here
double outputSpeed = lowBattery ? 0.3 : 0.75;      // ternary: compact if/else
```

With just these three ideas you can already describe most of what a robot tracks every cycle.
"""#,
        keyTakeaways: ["A variable is a named, typed box: `type name = value;` — declare once, reassign freely.", "Java is statically typed; the FRC workhorses are `int`, `double`, `boolean`, and `String`.", "Motor outputs are `double` values from -1.0 to 1.0, so never store them as `int`.", "`int / int` truncates (5/2 == 2); use a `double` operand for decimal results.", "`=` assigns a value; `==` compares — mixing them up is a top beginner bug."],
        resources: [SourceLink(title: "Oracle Java Tutorials: Primitive Data Types", url: URL(string: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html")!), SourceLink(title: "dev.java: Using Operators in Your Programs", url: URL(string: "https://dev.java/learn/language-basics/")!), SourceLink(title: "Oracle Java Tutorials: Summary of Variables", url: URL(string: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/variablesummary.html")!)],
        quiz: [
            QuizQuestion(question: "Which Java type should hold an FRC motor output value like 0.75, and why?", options: ["double, since the value is a fractional number", "int, because ports and IDs are also whole", "boolean, as it flags forward versus reverse", "char, which stores a single compact symbol"], answer: 0, explanation: "WPILib motor outputs are doubles from -1.0 to 1.0, so a fractional value like 0.75 needs a double; storing it in an int truncates the decimal to 0."),
            QuizQuestion(question: "What is the result of the Java expression 5 / 2, and why?", options: ["It gives 2.5 because Java always keeps decimals", "It gives 3 after Java rounds the result up", "It gives 2 since int division truncates", "It gives 2.0 since the output stays a double"], answer: 2, explanation: "int / int performs integer division and drops the remainder, so 5 / 2 is 2; making one side a double (5.0 / 2) yields 2.5."),
            QuizQuestion(question: "Which operator checks whether two values are equal in Java?", options: ["The = symbol, which assigns a value to it", "The == symbol, which compares two values", "The => symbol, which defines a lambda body", "The word equals, used only for text objects"], answer: 1, explanation: "== is the equality comparison operator that produces a boolean, while a single = assigns a value — mixing them up is a classic beginner bug."),
        ],
        verifiedAt: FlexibleDate.parse("2026-09-09T00:14:40.586+00:00"),
        verifiedBy: nil,
        verifiedNote: nil,
        verifiedSources: nil,
        youtubeID: "Y34DRfpkhNM"
    )

    /// All eleven real badges.
    static let achievements: [Achievement] = [
        Achievement(id: UUID(uuidString: "4f601fbb-cc19-4186-865f-2f75a1c8c5d2")!, slug: "first-lesson", name: "First Steps", description: "Complete your very first lesson.", icon: "CheckCircle2", criteria: AchievementCriteria(type: "lessons", count: 1, days: nil), sortOrder: 1),
        Achievement(id: UUID(uuidString: "31b14097-1f41-4795-be08-065def85ffeb")!, slug: "five-lessons", name: "Warmed Up", description: "Complete 5 lessons.", icon: "Flame", criteria: AchievementCriteria(type: "lessons", count: 5, days: nil), sortOrder: 2),
        Achievement(id: UUID(uuidString: "cf3a96a7-158c-47a2-84eb-05006a363faf")!, slug: "ten-lessons", name: "Committed", description: "Complete 10 lessons.", icon: "Flame", criteria: AchievementCriteria(type: "lessons", count: 10, days: nil), sortOrder: 3),
        Achievement(id: UUID(uuidString: "7d655c13-c698-4ba9-a703-606ade4b7dbf")!, slug: "twentyfive-lessons", name: "Quarter Master", description: "Complete 25 lessons.", icon: "Target", criteria: AchievementCriteria(type: "lessons", count: 25, days: nil), sortOrder: 4),
        Achievement(id: UUID(uuidString: "90f5a9e7-6ba0-44a2-860d-ba775bb7e282")!, slug: "fifty-lessons", name: "Half Centurion", description: "Complete 50 lessons.", icon: "Medal", criteria: AchievementCriteria(type: "lessons", count: 50, days: nil), sortOrder: 5),
        Achievement(id: UUID(uuidString: "c3729bbd-9d09-4dfe-99b2-38eead2fbbda")!, slug: "hundred-lessons", name: "Centurion", description: "Complete 100 lessons.", icon: "Star", criteria: AchievementCriteria(type: "lessons", count: 100, days: nil), sortOrder: 6),
        Achievement(id: UUID(uuidString: "b5bffad1-92ba-48e9-99d4-07db4fcc7be4")!, slug: "first-department", name: "Department Graduate", description: "Finish every lesson in a department.", icon: "GraduationCap", criteria: AchievementCriteria(type: "departments", count: 1, days: nil), sortOrder: 7),
        Achievement(id: UUID(uuidString: "bd4beaee-f380-4550-bbff-091af784c054")!, slug: "three-departments", name: "Multi-Disciplinary", description: "Finish 3 full departments.", icon: "Sparkles", criteria: AchievementCriteria(type: "departments", count: 3, days: nil), sortOrder: 8),
        Achievement(id: UUID(uuidString: "754586d5-4547-4a0d-aa53-5866eece0092")!, slug: "all-departments", name: "FRC Master", description: "Finish every department on LearnFRC.", icon: "Trophy", criteria: AchievementCriteria(type: "departments", count: 11, days: nil), sortOrder: 9),
        Achievement(id: UUID(uuidString: "9935f02c-0bcb-4239-936e-23f193fbdcff")!, slug: "three-day-streak", name: "On a Roll", description: "Maintain a 3-day learning streak.", icon: "Flame", criteria: AchievementCriteria(type: "streak", count: nil, days: 3), sortOrder: 10),
        Achievement(id: UUID(uuidString: "e2d90cf2-2e49-44e2-b944-b6deb422dbdd")!, slug: "week-streak", name: "Unstoppable", description: "Maintain a 7-day learning streak.", icon: "Flame", criteria: AchievementCriteria(type: "streak", count: nil, days: 7), sortOrder: 11),
    ]

    /// Three real articles. The brownout one keeps its opening sections (a table, code, internal links).
    static let articles: [Article] = [
        Article(
            id: UUID(uuidString: "38a35f43-9f33-4d00-a4e6-a337994f10a2")!, slug: "frc-brownout",
            title: "FRC Brownout: Why Your Robot Goes Limp and How to Actually Fix It",
            description: "The exact roboRIO brownout voltage stages, how to spot one in the Driver Station log, and the fixes ranked by payoff: current limits, battery health, gearing, and compressor scheduling.",
            keywords: ["FRC brownout", "roboRIO brownout voltage", "why does my robot brown out", "FRC current limit brownout", "roboRIO brownout stages", "Driver Station log brownout"],
            date: "2026-08-21", readMins: 7,
            content: #"""
**A brownout is the roboRIO protecting itself by cutting motor power once your battery voltage sags below a set threshold, and it's almost always a current problem, not a battery problem, even though a weak battery makes it much easier to trigger.** The roboRIO watches its own input voltage in real time and steps through a documented, staged shutdown as that voltage drops. It isn't guessing, and it isn't random. Once you know the exact stages and where to see one in your Driver Station log, you can tell which of the fixes below is actually worth your time first, instead of just swapping batteries and hoping.

## What's actually happening

Every subsystem on your robot shares one 12V battery. When several things draw hard current at once, like a drivetrain accelerating out of a stop while a compressor kicks on, the voltage at the battery terminals sags. The roboRIO's job is to keep itself and the rest of the control system (the radio, the CAN bus, your sensors) alive even when that happens, so it has a **staged brownout protection scheme** built in specifically to preserve its own input voltage and prevent an uncontrolled reset.

## The three brownout stages

| Stage | Voltage trigger | What happens |
| --- | --- | --- |
| **Stage 1** | Below 6.8V | The 6V rail on the roboRIO's PWM pins starts to sag. Only PWM-driven devices (older motor controllers, servos) are affected here; most modern CAN-based motor controllers won't notice yet. |
| **Stage 2** | Below 6.3V (roboRIO 1.0, fixed) or 6.75V (roboRIO 2.0, default) | Full brownout protection. PWM outputs disable after one neutral pulse, the 6V/5V/3.3V user rails shut off, GPIO outputs go high-impedance, relays disable, CAN motor controllers get an explicit disable command, and pneumatics devices (CTRE PCM, REV Pneumatic Hub) shut down. The roboRIO stays in this state until voltage climbs back above 7.5V. |
| **Stage 3** | Below 4.5V | The roboRIO itself may black out completely. It won't begin a normal reboot until voltage rises back above 4.65V. |

The roboRIO 2.0, the current standard FRC control system, lets you change the Stage 2 threshold in code:

```java
RobotController.setBrownoutVoltage(7.0);
```

```cpp
frc::RobotController::SetBrownoutVoltage(7_V);
```

Most teams never touch this. It's worth knowing it exists, but raising or lowering it doesn't fix the underlying current problem, it just moves where the roboRIO decides to give up. Check the current [WPILib docs](https://docs.wpilib.org/en/stable/docs/software/roborio-info/roborio-brownouts.html) for your season, since these numbers are exactly the kind of thing that can shift with a control system change like the upcoming [SystemCore](/blog/frc-systemcore) transition.

## How to catch it

**Live, on the field:** the roboRIO's power LED turns amber, the voltage box on the Driver Station turns red, and the status string switches to "Voltage Brownout." See our [status lights guide](/blog/frc-status-lights-and-error-codes) for what every other blink pattern means.

**After the match, in the log:** open the Driver Station Log File Viewer (the gear icon in the DS, or the shortcut in your FRC Driver Station Start Menu folder). The battery voltage plots as a yellow line over time, and any brownout event is marked with a bright orange line right where it happened. If you just want a fast yes/no, the **CAN/Power tab** on the live Driver Station shows a 12V fault counter that increments by one every time Stage 2 triggers. For a deeper look at current per motor, per subsystem, over time, [AdvantageScope](/blog/frc-advantagescope-guide) reads the same logs with far more detail than the stock viewer.
"""#,
            sortOrder: 57
        ),
        Article(
            id: UUID(uuidString: "f4fc0697-3144-41a3-bf24-bcd3c9681a61")!, slug: "frc-can-bus",
            title: "FRC CAN Bus Explained (and How to Fix Common Problems)",
            description: "How the FRC CAN bus works, the daisy-chain wiring with 120-ohm termination, avoiding device ID conflicts, and fixing the most common CAN failures.",
            keywords: ["FRC CAN bus", "FRC CAN bus not working", "FRC CAN ID conflict", "roboRIO CAN", "FRC CAN troubleshooting"],
            date: "2026-06-24", readMins: 8,
            content: #"""
Almost every motor controller, your power distribution board, and most of your sensors talk to the roboRIO over a single pair of wires. That pair is the CAN bus, and when it works you forget it exists. When it breaks, your whole robot can go dark at once. The good news: CAN failures are extremely predictable, and almost all of them come down to four or five causes you can learn to spot in minutes. This guide explains what CAN is, how to wire it correctly, and exactly how to track down the most common problems with the same tools the pros use.

## What CAN is and why FRC uses it

**CAN** stands for Controller Area Network. It's a communication standard originally built for cars, where dozens of electronic modules need to share one network reliably in a noisy electrical environment. FRC adopted it for the same reason: instead of running a separate control wire to every device, every device shares one bus.

The big advantage is data and wiring. A CAN connection is daisy-chained from device to device, which usually means much shorter wire runs, and it carries far more information than the old PWM signal wires could. According to [WPILib's "Using CAN Devices" docs](https://docs.wpilib.org/en/stable/docs/software/can-devices/using-can-devices.html), CAN lets devices report rich telemetry back to the roboRIO, like motor temperature, current draw, and encoder position, all over the same two wires that carry commands out.

Devices that live on the CAN bus include CTRE **Talon FX** / Kraken motors, **CANcoder** and **Pigeon 2.0** sensors, REV **SPARK MAX** and **SPARK Flex** controllers, and your **Power Distribution Panel (PDP)** or **Power Distribution Hub (PDH)**.
"""#,
            sortOrder: 24
        ),
        Article(
            id: UUID(uuidString: "dc767528-5423-4457-a9ea-300332a858c9")!, slug: "frc-preseason-training-plan",
            title: "The FRC Preseason Training Plan: A Week-by-Week Guide from September to Kickoff",
            description: "A concrete week-by-week FRC preseason plan from September to kickoff, with a training robot, subteam curriculum order, and real deliverables at each phase.",
            keywords: ["FRC preseason plan", "FRC training robot", "what to do before FRC kickoff", "FRC offseason schedule September", "FRC subteam training plan", "AM14U6 training chassis"],
            date: "2026-08-21", readMins: 6,
            content: #"""
A strong preseason plan runs from the first week of September to kickoff on **Saturday, January 9, 2027 at noon ET**, the date FIRST has published for the BIOCORE season, and it needs three things most teams skip: a training robot that isn't a mockup of next year's game, a fixed order for what each subteam learns, and real deliverables with dates attached instead of a standing goal like "learn CAD." Below is a week-by-week structure you can adapt to your own school calendar. It stops at kickoff; for what comes after the game is revealed, see the [build season timeline](/blog/frc-build-season-timeline).

## Build a training robot, not a mockup of the game

You don't know what the 2027 game is yet, so don't try to guess it. What you can build in September is a generic chassis that teaches wiring, code, and driving, then gets torn apart or repurposed once BIOCORE is revealed. Most veteran teams reach for a spare or leftover **AM14U6**, the six-wheel drop-center chassis AndyMark supplied as the base for the 2026 KitBot and still sells standalone (around $940, in long, square, or wide configurations with ToughBox Mini S gearboxes). It's a good training platform specifically because it already has published wiring diagrams and example WPILib code, so new members aren't debugging your team's homemade frame and CAN wiring at the same time. No spare chassis? A simple wood-and-wheels test base works almost as well for wiring and code practice, since the goal here is function, not competition tolerances.

Whatever base you use, treat it as shared property across mechanical, electrical, and programming. It should get re-wired, re-coded, and re-driven several times before January. That repetition is the actual training.
"""#,
            sortOrder: 64
        ),
    ]

    /// Real glossary terms (from src/lib/glossary-data.ts).
    static let glossary: [GlossaryTerm] = [
        GlossaryTerm(
            term: "WPILib", abbr: nil, category: "Software",
            definition: "The official, free software library for programming FRC robots in Java, C++, or Python (RobotPy).",
            link: "https://docs.wpilib.org", internalLink: nil,
            inMatch: "WPILib is the layer between your code and everything else — motor controllers, the driver station, the field management system, and the timing of your robot's periodic loop. In practice you meet it through its opinions: the command-based structure, the units library, the simulator, and the yearly version bump you do in the first week of build season.",
            alsoCalled: [], lessonCues: ["WPILib", "wpilib"], related: ["Command-Based Programming", "RobotPy", "Driver Station"],
            slug: "wpilib"
        ),
        GlossaryTerm(
            term: "Command-Based Programming", abbr: nil, category: "Software",
            definition: "WPILib's recommended structure that organizes robot code into Subsystems and Commands for clean, reusable behavior.",
            link: "https://docs.wpilib.org/en/stable/docs/software/commandbased/index.html", internalLink: nil,
            inMatch: "Command-based is what stops robot code turning into one enormous if-statement. Subsystems own hardware, commands own behaviour, and the scheduler guarantees two commands never fight over the same motor. The payoff shows up in autonomous, where you compose the same commands into a sequence, and in debugging, where you can point at exactly which command is misbehaving.",
            alsoCalled: ["Command-based", "Commands and subsystems"], lessonCues: ["command-based", "command based", "subsystem", "subsystems"], related: ["WPILib", "PID Controller", "Autonomous"],
            slug: "command-based-programming"
        ),
        GlossaryTerm(
            term: "PID Controller", abbr: "PID", category: "Software",
            definition: "A feedback control loop (Proportional-Integral-Derivative) that drives a mechanism to a target by reacting to error.",
            link: "https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/introduction-to-pid.html", internalLink: "/blog/pid-control-frc",
            inMatch: "PID is how an arm holds a position instead of slamming into a hard stop. You meet it the first time a mechanism overshoots, oscillates, or sags under gravity — and then you meet the tuning process, which is a methodical loop of raising kP until it oscillates, adding kD to damp that out, and using kI sparingly, if at all.",
            alsoCalled: ["Closed-loop control", "PID loop"], lessonCues: ["PID", "closed-loop", "closed loop"], related: ["Feedforward", "Encoder", "Command-Based Programming"],
            slug: "pid-controller"
        ),
        GlossaryTerm(
            term: "roboRIO", abbr: nil, category: "Electrical",
            definition: "The National Instruments controller that is the 'brain' of the robot, running team code and coordinating all devices.",
            link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html", internalLink: "/blog/frc-roborio-guide",
            inMatch: "Everything on the robot ends at the roboRIO. It runs your code on a real-time loop, talks to motor controllers over CAN, reads sensors on its DIO and analog ports, and reports back to the driver station. When it browns out under a 12-volt sag, or your code overruns its 20-millisecond loop, the whole robot stops — so voltage and loop timing are the first two things to check.",
            alsoCalled: ["roboRIO 2.0", "The robot's brain"], lessonCues: ["roboRIO", "robo rio"], related: ["CAN bus", "Driver Station", "Power Distribution Hub"],
            slug: "roborio"
        ),
        GlossaryTerm(
            term: "Gracious Professionalism", abbr: "GP", category: "General",
            definition: "A core FIRST value: competing hard while treating everyone with respect, kindness, and integrity.",
            link: "https://www.firstinspires.org/about/vision-and-mission", internalLink: nil,
            inMatch: "GP is not a poster. It is what happens at four o'clock on Saturday when the alliance that just knocked you out asks to borrow your spare motor controller and you hand it over. Judges watch for it in the pit, referees notice it at the field, and it is the difference between a team other teams want to pick and one they quietly avoid.",
            alsoCalled: [], lessonCues: ["gracious professionalism", "core values"], related: ["Coopertition", "Impact Award", "Woodie Flowers Award"],
            slug: "gracious-professionalism"
        ),
        GlossaryTerm(
            term: "Kickoff", abbr: nil, category: "General",
            definition: "The event in early January that opens the season: the new game is revealed and the build period begins.",
            link: "https://www.firstinspires.org/robotics/frc/kickoff", internalLink: nil,
            inMatch: "Kickoff is the most consequential Saturday of your season. The game animation drops and within hours your team has to read the manual, argue about scoring priorities, and decide what the robot must do. Teams that lose their season usually lose it here — by opening CAD before anyone has read the rules, or by chasing every scoring element instead of picking two.",
            alsoCalled: ["Kickoff Saturday", "Game reveal"], lessonCues: ["kickoff", "game reveal", "annual season"], related: ["Build Season", "Kit of Parts", "FIRST Choice"],
            slug: "kickoff"
        ),
        GlossaryTerm(
            term: "Swerve Drive", abbr: nil, category: "Mechanical",
            definition: "A drivetrain where each wheel module can independently steer and drive, giving full omnidirectional movement.",
            link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/swerve-drive-kinematics.html", internalLink: "/blog/swerve-drive-explained",
            inMatch: "Swerve is the default now, and it changes what your drivers practise: translation and rotation are independent, so approaching a scoring location no longer means lining up first. The cost is real — four steering motors, four absolute encoders, module offsets that must be re-zeroed, and a maintenance schedule. A well-driven tank robot still beats a poorly maintained swerve.",
            alsoCalled: ["Swerve", "Independent module drive"], lessonCues: ["swerve", "swerve drive", "swerve module"], related: ["Odometry", "Gear Ratio", "Kraken X60"],
            slug: "swerve-drive"
        ),
    ]
    static let glossaryCategories: [String] = ["General", "Competition & Game", "Software", "Electrical", "Mechanical", "Sensors & Controls", "Awards", "Data & Scouting", "Community"]

    /// Two real learning paths.
    static let paths: [LearningPath] = [
        LearningPath(
            slug: "new-member-onboarding", title: "New Member Onboarding",
            description: "Brand new to the team? This is the path that turns a curious rookie into a contributing member — culture, shop safety, and your first real hands on the robot.",
            icon: "Rocket", color: "#3b82f6",
            outcomes: ["Understand what FRC is, the season cadence, and how a team runs", "Pass shop safety and work confidently around tools and the robot", "Build, wire, and power a basic mechanism with the team", "Know which department fits you best and how to go deeper"],
            steps: [
                .init(deptSlug: "getting-started", label: "Learn how FRC works", note: "Start here. Get the big picture: the game cycle, kickoff, regionals, and how the departments fit together so nothing else feels like a mystery."),
                .init(deptSlug: "safety", label: "Earn your shop safety basics", note: "Before you touch a tool or the robot, learn PPE, safe tool use, and shop etiquette. Safety isn't optional — it's the first thing every veteran respects."),
                .init(deptSlug: "mechanical-build", label: "Get hands on the robot", note: "Learn fasteners, the build process, and how mechanisms come together. This is where the robot stops being abstract and starts being real."),
                .init(deptSlug: "electrical-wiring", label: "See how it gets powered", note: "Follow power from the battery through the PDH to the motors. Even non-electrical members should understand how the robot actually turns on."),
                .init(deptSlug: "media-outreach", label: "Find your voice on the team", note: "Onboarding isn't only the robot — see how the team tells its story and how every member can contribute beyond the shop."),
            ]
        ),
        LearningPath(
            slug: "become-a-robot-programmer", title: "Become a Robot Programmer",
            description: "Go from zero code to writing real, competition-ready robot software — command-based WPILib, sensors, and tuned autonomous routines.",
            icon: "Code2", color: "#10b981",
            outcomes: ["Set up the WPILib toolchain and deploy code to a roboRIO", "Write clean, command-based subsystems and commands", "Read sensors and close the loop with PID/feedforward control", "Build and tune a reliable autonomous routine for match play"],
            steps: [
                .init(deptSlug: "getting-started", label: "Ground yourself in FRC", note: "Understand the control system, the match flow, and where software fits before you write a single line of code."),
                .init(deptSlug: "programming-software", label: "Learn WPILib & command-based", note: "The core of the path. Install the toolchain, structure subsystems and commands, and deploy your first working robot program."),
                .init(deptSlug: "electrical-wiring", label: "Understand the hardware you control", note: "Great code needs hardware fluency — know your motor controllers, CAN bus, and sensors so you can debug from the wire up."),
                .init(deptSlug: "mechanical-build", label: "Know the mechanisms you drive", note: "Understand gear ratios, mechanism limits, and how the robot moves so your code matches the physics it's commanding."),
                .init(deptSlug: "scouting-strategy", label: "Code for the strategy", note: "The best autonomous and controls serve a game plan. Learn how strategy shapes which routines and features actually win matches."),
            ]
        ),
    ]
}
