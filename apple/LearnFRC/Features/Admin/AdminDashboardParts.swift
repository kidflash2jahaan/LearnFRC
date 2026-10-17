import SwiftUI

// The top of /admin: the taped card of what wants a person today, the four standing totals
// on the blue slab, the honesty notes under it, and the tally sheet.

// MARK: - What wants a person today

/// The taped card at the top of /admin: a figure and what it wants, one line each. The
/// messages and applications rows open the screens that answer them.
struct AdminNowCard: View {
    let now: AdminDashboard.Now
    let isSuperAdmin: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            NotebookCard(tilt: .preset(1), tape: true, padding: 22) {
                AccountSheetSlug("what wants a person today")
                VStack(alignment: .leading, spacing: 0) {
                    AdminNowRow(value: now.onlineNow, label: "people on the site right now", hint: "active in the last few minutes")
                    rule
                    AdminLink(to: .feedback) {
                        AdminNowRow(
                            value: now.openFeedback,
                            label: "messages waiting for a reply",
                            hint: "\(now.feedbackTotal.formatted()) received in total",
                            isLink: true
                        )
                    }
                    .buttonStyle(.inkRow)
                    .accessibilityHint("Opens the feedback inbox")
                    // Super admins only: applications are the one thing nobody else can answer.
                    if isSuperAdmin {
                        rule
                        let waiting = now.pendingApplications ?? 0
                        AdminLink(to: .team) {
                            AdminNowRow(
                                value: waiting,
                                label: waiting == 1 ? "application waiting on you" : "applications waiting on you",
                                hint: "only a super admin can answer these",
                                isLink: true
                            )
                        }
                        .buttonStyle(.inkRow)
                        .accessibilityHint("Opens the admin team desk")
                    }
                    rule
                    AdminNowRow(value: now.pendingEdits, label: "content edits to review")
                    rule
                    AdminNowRow(value: now.pendingSubmissions, label: "lesson submissions to review")
                }
                .padding(.top, 4)
            }
            MarkerText("this card first, the rest after")
                .padding(.top, 16)
                .padding(.leading, 6)
                .padding(.trailing, 8)
        }
    }

    private var rule: some View {
        Rectangle().fill(LF.Palette.ink.opacity(0.13)).frame(height: 1).accessibilityHidden(true)
    }
}

/// One line of the card: the figure, then what it wants. A row that opens a screen takes a
/// standing 2pt underline on its label, so it's findable without a pointer.
struct AdminNowRow: View {
    let value: Int
    let label: String
    var hint: String?
    var isLink = false

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 6) {
                    figure
                    words
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    figure
                        .frame(minWidth: 44, alignment: .leading)
                    words
                    Spacer(minLength: 0)
                    if isLink {
                        Image(systemName: "arrow.right")
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(LF.Palette.blue)
                            .accessibilityHidden(true)
                    }
                }
            }
        }
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(value.formatted()) \(label)"))
        .accessibilityValue(hint ?? "")
    }

    private var figure: some View {
        Text(value.formatted())
            .font(LF.Fonts.mono(28, weight: .bold, relativeTo: .title))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.blue)
            .lineLimit(1)
            .fixedSize()
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(LF.Fonts.body(16, weight: isLink ? .bold : .regular, relativeTo: .body))
                .foregroundStyle(isLink ? LF.Palette.blue : LF.Palette.ink)
                .underline(isLink, color: LF.Palette.blue)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            if let hint {
                SlugText(hint)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - The slab

/// "How far it has got.": the four totals stamped on the one inverted surface.
struct AdminStampsBand: View {
    let stamps: [AdminDashboard.Stamp]
    let layout: AdminLayout

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Text("How far it has got.")
                    .lfTitle(.h2, color: LF.Palette.onBlue)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Totals over the whole history of the site, not a window. The note under this band says how far back each of them can actually see.")
                    .lfProse(16, lineHeight: 1.5, color: LF.Palette.onBlue.opacity(0.88))
                    .frame(maxWidth: 520, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
            .adminLeadingPage(layout)
            AdminColumnsLayout(columns: layout.stampColumns, spacing: 32, rowSpacing: 30, crease: layout.columnCrease) {
                ForEach(stamps, id: \.key) { stamp in
                    AdminSlabFigure(figure: stamp.value.formatted(), caption: stamp.label, size: layout.stampColumns == 4 ? 46 : 34)
                }
            }
            .padding(.top, 30)
        }
        .adminColumn(layout)
        .padding(.vertical, layout.isWide ? 52 : 38)
        .adminBand()
    }
}

/// A big figure on the slab (`nb-stamp`): oversized mono over a caption under a thin rule. They
/// land once, like a total being stamped; flat under Reduce Motion.
struct AdminSlabFigure: View {
    let figure: String
    let caption: String
    var size: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var landed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(figure)
                .font(LF.Fonts.mono(size, weight: .bold, relativeTo: .largeTitle))
                .tracking(size * -0.04)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.45)
                .scaleEffect(landed || reduceMotion ? 1 : SiteTokens.Movement.inkScale, anchor: .bottomLeading)
                .offset(y: landed || reduceMotion ? 0 : SiteTokens.Movement.inkDrop)
            Text(caption)
                .font(LF.Fonts.mono(12.8, relativeTo: .caption))
                .opacity(0.88)
                .padding(.top, 7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) {
                    Rectangle().fill(LF.Palette.onBlue.opacity(0.4)).frame(height: 1)
                }
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(LF.Palette.onBlue)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(figure) \(caption)"))
        .onAppear {
            guard !landed else { return }
            if reduceMotion { landed = true } else { withAnimation(LF.Motion.stamp) { landed = true } }
        }
    }
}

// MARK: - Tally sheet

/// "Everything else, ruled off.": one hand-drawn box divided into columns, one line per
/// reading. Three across on wide windows (the site turns over at 861pt), stacked on a phone,
/// two on an open foldable with the dividing rule on the fold.
struct AdminTallySheet: View {
    let columns: [AdminDashboard.TallyColumn]
    let layout: AdminLayout

    var body: some View {
        let count = min(max(layout.tallyColumns, 1), max(columns.count, 1))
        Group {
            if count == 1 {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(columns.enumerated()), id: \.offset) { index, column in
                        if index > 0 { InkRule() }
                        AdminTallyColumn(column: column)
                            .padding(LF.Metrics.cardPadding)
                    }
                }
            } else {
                AdminColumnsLayout(columns: count, spacing: 0, crease: count == 2 ? sheetCrease : nil, stretchesRows: true) {
                    ForEach(Array(columns.enumerated()), id: \.offset) { index, column in
                        AdminTallyColumn(column: column)
                            .padding(LF.Metrics.cardPadding)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                            .overlay(alignment: .leading) {
                                if index % count != 0 {
                                    Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.stroke)
                                        .accessibilityHidden(true)
                                }
                            }
                            .overlay(alignment: .top) {
                                if index >= count { InkRule() }
                            }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox(shadow: .none)
    }

    /// The fold, narrowed to a hairline: the column rule sits on it with no gap either side.
    private var sheetCrease: AdminCrease? {
        guard let crease = layout.columnCrease else { return nil }
        let middle = (crease.minX + crease.maxX) / 2
        return AdminCrease(minX: middle, maxX: middle)
    }
}

/// One panel of the sheet, headed by its slug.
private struct AdminTallyColumn: View {
    let column: AdminDashboard.TallyColumn

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText(column.slug)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(column.rows.enumerated()), id: \.offset) { index, row in
                    if index > 0 { DashedRule() }
                    AdminTallyRow(row: row)
                        .padding(.top, index == 0 ? 0 : 10)
                        .padding(.bottom, 10)
                }
            }
            .padding(.top, 12)
        }
        .accessibilityElement(children: .contain)
    }
}

/// One reading: the label and its qualifier on the left, the figure on the right.
private struct AdminTallyRow: View {
    let row: AdminDashboard.TallyColumn.Row

    private var printed: String { "\(row.value.formatted())\(row.suffix ?? "")" }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(row.label)
                    .font(LF.Fonts.body(15.5, relativeTo: .body))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if let hint = row.hint {
                    SlugText(hint)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(printed)
                .font(LF.Fonts.mono(19, weight: .bold, relativeTo: .title3))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
                .fixedSize()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.label)
        .accessibilityValue(row.hint.map { "\(printed), \($0)" } ?? printed)
    }
}

// MARK: - Recent activity

/// Newest members and recent completions, side by side when there's room.
struct AdminActivityLists: View {
    let activity: AdminDashboard.Activity
    let isLargeText: Bool

    var body: some View {
        AdminColumnsLayout(isLargeText ? .fixed(1) : .adaptive(minColumnWidth: 240), spacing: 32, rowSpacing: 24) {
            VStack(alignment: .leading, spacing: 10) {
                AdminSubhead("newest members")
                if activity.newestMembers.isEmpty {
                    SlugText("No signups yet.").padding(.vertical, 6)
                } else {
                    rows(activity.newestMembers.prefix(8).map { member in
                        (
                            primary: member.username.map { "@\($0)" } ?? "New member",
                            secondary: member.teamNumber.map { "#\($0)" },
                            secondaryIsSlug: true,
                            date: member.createdAt
                        )
                    })
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Newest members")

            VStack(alignment: .leading, spacing: 10) {
                AdminSubhead("recent completions")
                if activity.recentCompletions.isEmpty {
                    SlugText("No completions yet.").padding(.vertical, 6)
                } else {
                    rows(activity.recentCompletions.prefix(8).map { completion in
                        (primary: completion.user, secondary: completion.lesson, secondaryIsSlug: false, date: completion.at)
                    })
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Recent completions")
        }
    }

    private func rows(_ items: [(primary: String, secondary: String?, secondaryIsSlug: Bool, date: Date?)]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                if index > 0 { DashedRule() }
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Group {
                        if let secondary = item.secondary {
                            if item.secondaryIsSlug {
                                Text("\(Text(item.primary))  \(Text(secondary).font(LF.Fonts.mono(12.5, relativeTo: .caption)).foregroundStyle(LF.Palette.graphite))")
                            } else {
                                Text("\(Text(item.primary)) \(Text(secondary).foregroundStyle(LF.Palette.graphite))")
                            }
                        } else {
                            Text(item.primary)
                        }
                    }
                    .font(LF.Fonts.body(15.5, relativeTo: .body))
                    .foregroundStyle(LF.Palette.ink)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(AdminText.ago(item.date, ago: false))
                        .fixedSize()
                }
                .padding(.top, index == 0 ? 0 : 9)
                .padding(.bottom, 9)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: [item.primary, item.secondary].compactMap { $0 }.joined(separator: ", ")))
                .accessibilityValue(AdminText.spokenAgo(item.date))
            }
        }
    }
}
