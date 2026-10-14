import Foundation

/// The PostgREST column lists the app reads. Kept apart from `SupabaseService`
/// (no Supabase import) so a plain script can hit the same queries to check decoding.
enum SupabaseQueries {
    /// Departments with modules and lesson summaries embedded, in one request.
    static let catalogSelect = """
    id,slug,name,tagline,description,difficulty,estimated_hours,what_youll_learn,prerequisites,tools,sources,icon,sort_order,\
    modules(id,department_id,slug,title,overview,sort_order,is_prerequisite,\
    lessons(id,module_id,slug,title,summary,estimated_minutes,sort_order,youtube_id))
    """

    /// Every lesson body (markdown, takeaways, resources, quiz, verification).
    static let lessonBodySelect = "id,content,key_takeaways,resources,quiz,verified_at,verified_by,verified_note,verified_sources,youtube_id"

    static let articleSelect = "id,slug,title,description,keywords,date,read_mins,content,sort_order"

    static let achievementSelect = "id,slug,name,description,icon,criteria,sort_order"

    static let bookmarkSelect = "lesson_id,created_at"

    /// PostgREST's silent row cap. Anything that could pass it is paged.
    static let pageSize = 1000
}
