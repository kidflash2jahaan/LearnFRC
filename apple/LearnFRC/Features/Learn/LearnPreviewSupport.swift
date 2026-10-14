import SwiftUI

/// Preview helpers for the Learn screens. `PreviewData` carries two real departments;
/// the wall reads best with all eleven, so the other nine are filled in with their real
/// names, slugs, symbols and taglines from the site's `DEPT_CATALOG` and the real module
/// and lesson counts, borrowing the two real departments' lesson rows for the counts.
/// Only the wall and the counts use them; every detail screen previews real data.
@MainActor
enum LearnPreviewCatalog {
    private struct Stub {
        let slug, name, tagline, icon: String
        let sort, modules, lessons: Int
    }

    private static let stubs: [Stub] = [
        Stub(slug: "getting-started", name: "Getting Started with FRC", tagline: "New to FIRST Robotics? Start your journey here.", icon: "Rocket", sort: 0, modules: 7, lessons: 28),
        Stub(slug: "mechanical-build", name: "Mechanical, Build & Pneumatics", tagline: "Drivetrains, mechanisms, fabrication, and pneumatics.", icon: "Cog", sort: 1, modules: 12, lessons: 47),
        Stub(slug: "cad-design", name: "CAD & Design", tagline: "Design robots in Onshape, SolidWorks & Fusion.", icon: "PenTool", sort: 2, modules: 8, lessons: 31),
        Stub(slug: "electrical-wiring", name: "Electrical & Wiring", tagline: "Power, the control system, and legal wiring.", icon: "Zap", sort: 4, modules: 8, lessons: 35),
        Stub(slug: "media-outreach", name: "Media, Branding & Outreach", tagline: "Branding, media, and community impact.", icon: "Camera", sort: 6, modules: 8, lessons: 29),
        Stub(slug: "impact-award", name: "The Impact Award", tagline: "Pursue FRC's most prestigious award.", icon: "Trophy", sort: 7, modules: 8, lessons: 30),
        Stub(slug: "scouting-strategy", name: "Scouting & Strategy", tagline: "Turn match data into winning strategy.", icon: "LineChart", sort: 8, modules: 8, lessons: 32),
        Stub(slug: "drive-team", name: "Drive Team", tagline: "Driver, operator, and coach on the field.", icon: "Gamepad2", sort: 9, modules: 8, lessons: 34),
        Stub(slug: "safety", name: "Safety", tagline: "Build a safety-first robotics culture.", icon: "ShieldCheck", sort: 10, modules: 7, lessons: 28),
    ]

    /// All eleven departments in the site's order.
    static let wallDepartments: [Department] = {
        let donor = PreviewData.departments.flatMap { $0.lessons }
        var made: [Department] = stubs.map { stub in
            let departmentID = UUID()
            var remaining = stub.lessons
            let modules: [Module] = (0..<stub.modules).map { m in
                let moduleID = UUID()
                let count = m == stub.modules - 1 ? remaining : min(remaining, max(1, stub.lessons / stub.modules))
                remaining -= count
                let lessons = (0..<count).map { l in
                    let source = donor[(m * 5 + l) % donor.count]
                    return LessonSummary(id: UUID(), moduleID: moduleID, slug: "\(source.slug)-\(m)-\(l)",
                                         title: source.title, summary: source.summary,
                                         estimatedMinutes: source.estimatedMinutes, sortOrder: l)
                }
                return Module(id: moduleID, departmentID: departmentID, slug: "module-\(m)",
                              title: "Module \(m + 1)", sortOrder: m, isPrerequisite: m == 0, lessons: lessons)
            }
            return Department(id: departmentID, slug: stub.slug, name: stub.name, tagline: stub.tagline,
                              icon: stub.icon, sortOrder: stub.sort, modules: modules)
        }
        made.append(contentsOf: PreviewData.departments)
        return made.sorted { $0.sortOrder < $1.sortOrder }
    }()

    /// The preview app with all eleven departments on the wall.
    static func model(signedIn: Bool = true) -> AppModel {
        let model = AppModel.preview(signedIn: signedIn)
        model.catalog.apply(departments: wallDepartments, achievements: PreviewData.achievements)
        model.progress.catalogDidChange()
        return model
    }
}
