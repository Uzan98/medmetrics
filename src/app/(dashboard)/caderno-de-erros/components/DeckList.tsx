import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, FileText, Play, Layers, BookOpen, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isPast, isToday, parseISO } from 'date-fns'

// Types (matching page.tsx)
type Database = any

interface ErrorEntry {
    id: string
    discipline_id: number | null
    topic_id: number | null
    topics: { id: number; name: string; subdiscipline_id: number | null } | null
    review_count: number
    interval: number
    next_review_date: string | null
}

interface Discipline {
    id: number
    name: string
}

interface Subdiscipline {
    id: number
    name: string
    discipline_id: number | null
}

interface DeckListProps {
    entries: ErrorEntry[]
    disciplines: Discipline[]
    subdisciplines: Subdiscipline[]
    onStudy: (disciplineId: number | 'all', subdisciplineId: number | 'all', topicId: number | 'all' | number[]) => void
    onDelete: (disciplineId: number | null, subdisciplineId: number | null, topicId: number | null | number[]) => void
}

interface TopicNode {
    name: string
    topicIds: number[]
    stats: DeckStats
    children: Record<string, TopicNode>
}

interface DeckStats {
    new: number
    learn: number
    review: number
    total: number
}

export function DeckList({ entries, disciplines, subdisciplines, onStudy, onDelete }: DeckListProps) {
    const [expandedDisciplines, setExpandedDisciplines] = useState<number[]>([])
    const [expandedSubdisciplines, setExpandedSubdisciplines] = useState<number[]>([])
    const [expandedTopics, setExpandedTopics] = useState<string[]>([])

    // Build Hierarchy with Stats
    const hierarchy = useMemo(() => {
        const tree: Record<number, {
            discipline: Discipline,
            stats: DeckStats,
            subdisciplines: Record<number, {
                subdiscipline: Subdiscipline,
                stats: DeckStats,
                topicTree: Record<string, TopicNode>
            }>,
            topicTree: Record<string, TopicNode>
        }> = {}

        const emptyStats = () => ({ new: 0, learn: 0, review: 0, total: 0 })

        entries.forEach(entry => {
            const discId = entry.discipline_id

            if (!discId) return
            if (!disciplines.find(d => d.id === discId)) return

            // Determine Card State
            let state: 'new' | 'learn' | 'review' | 'notDue' = 'new'

            if (entry.review_count > 0) {
                const dueDate = entry.next_review_date ? parseISO(entry.next_review_date) : null
                const isDue = dueDate ? (isPast(dueDate) || isToday(dueDate)) : true

                if (isDue) {
                    if (entry.interval <= 1) state = 'learn'
                    else state = 'review'
                } else state = 'notDue'
            }

            // Update Stats Helper
            const updateStats = (stats: DeckStats) => {
                stats.total++
                if (state !== 'notDue') stats[state as keyof DeckStats]++
            }

            if (!tree[discId]) {
                const disc = disciplines.find(d => d.id === discId)
                if (disc) {
                    tree[discId] = { discipline: disc, stats: emptyStats(), subdisciplines: {}, topicTree: {} }
                } else return
            }
            updateStats(tree[discId].stats)

            const subId = entry.topics?.subdiscipline_id

            if (subId) {
                if (!tree[discId].subdisciplines[subId]) {
                    const sub = subdisciplines.find(s => s.id === subId)
                    if (sub) {
                        tree[discId].subdisciplines[subId] = { subdiscipline: sub, stats: emptyStats(), topicTree: {} }
                    } else {
                        tree[discId].subdisciplines[subId] = {
                            subdiscipline: { id: subId, name: `Subdiscipline #${subId}`, discipline_id: discId },
                            stats: emptyStats(),
                            topicTree: {}
                        }
                    }
                }
                updateStats(tree[discId].subdisciplines[subId].stats)

                const topic = entry.topics
                if (topic) {
                    const pathParts = topic.name.split(' > ').map(s => s.trim())
                    let currentLevel = tree[discId].subdisciplines[subId].topicTree

                    pathParts.forEach(part => {
                        if (!currentLevel[part]) {
                            currentLevel[part] = { name: part, topicIds: [], stats: emptyStats(), children: {} }
                        }
                        updateStats(currentLevel[part].stats)
                        if (!currentLevel[part].topicIds.includes(topic.id)) {
                            currentLevel[part].topicIds.push(topic.id)
                        }
                        currentLevel = currentLevel[part].children
                    })
                }
            } else if (entry.topics) {
                // Direct Topic
                const topic = entry.topics
                const pathParts = topic.name.split(' > ').map(s => s.trim())
                let currentLevel = tree[discId].topicTree

                pathParts.forEach(part => {
                    if (!currentLevel[part]) {
                        currentLevel[part] = { name: part, topicIds: [], stats: emptyStats(), children: {} }
                    }
                    updateStats(currentLevel[part].stats)
                    if (!currentLevel[part].topicIds.includes(topic.id)) {
                        currentLevel[part].topicIds.push(topic.id)
                    }
                    currentLevel = currentLevel[part].children
                })
            } else {
                // No Topic
                const generalTopicName = 'Geral (Sem Assunto)'
                const generalTopicId = -999
                if (!tree[discId].topicTree[generalTopicName]) {
                    tree[discId].topicTree[generalTopicName] = {
                        name: generalTopicName,
                        topicIds: [generalTopicId],
                        stats: emptyStats(),
                        children: {}
                    }
                }
                updateStats(tree[discId].topicTree[generalTopicName].stats)
            }
        })

        return Object.values(tree).sort((a, b) => a.discipline.name.localeCompare(b.discipline.name))
    }, [entries, disciplines, subdisciplines])

    const toggleDiscipline = (id: number) => {
        setExpandedDisciplines(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const toggleSubdiscipline = (id: number) => {
        setExpandedSubdisciplines(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const toggleTopic = (pathId: string) => {
        setExpandedTopics(prev => prev.includes(pathId) ? prev.filter(p => p !== pathId) : [...prev, pathId])
    }

    // Header Component
    const ListHeader = () => (
        <div className="flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 py-3 border-b border-zinc-800/50 bg-zinc-900/50">
            <div className="flex-1 pl-1 sm:pl-2">Baralho</div>
            <div className="flex items-center gap-2 sm:gap-10 mr-14 sm:mr-24">
                <div className="w-8 sm:w-12 text-center text-blue-400" title="Novos">N<span className="hidden sm:inline">ovos</span></div>
                <div className="w-8 sm:w-12 text-center text-red-400" title="Aprender">A<span className="hidden sm:inline">pren</span></div>
                <div className="w-8 sm:w-12 text-center text-emerald-400" title="Revisar">R<span className="hidden sm:inline">ev</span></div>
            </div>
        </div>
    )

    // Stats Display Component
    const StatsDisplay = ({ stats }: { stats: DeckStats }) => (
        <div className="flex items-center gap-2 sm:gap-10 text-sm font-medium mr-2">
            <div className={`w-8 sm:w-12 text-center ${stats.new > 0 ? 'text-blue-400 font-bold' : 'text-zinc-700'}`}>
                {stats.new}
            </div>
            <div className={`w-8 sm:w-12 text-center ${stats.learn > 0 ? 'text-red-400 font-bold' : 'text-zinc-700'}`}>
                {stats.learn}
            </div>
            <div className={`w-8 sm:w-12 text-center ${stats.review > 0 ? 'text-emerald-400 font-bold' : 'text-zinc-700'}`}>
                {stats.review}
            </div>
        </div>
    )

    // Recursive Topic Tree Renderer
    const TopicTreeRender = ({
        nodes,
        basePath,
        level,
        discId,
        subId
    }: {
        nodes: Record<string, TopicNode>,
        basePath: string,
        level: number,
        discId: number,
        subId: number | null
    }) => {
        return (
            <div className={level > 0 ? "ml-4 sm:ml-8 border-l border-zinc-800/50" : ""}>
                {Object.values(nodes).map(node => {
                    const currentPath = `${basePath}_${node.name}`
                    const isExpanded = expandedTopics.includes(currentPath)
                    const hasChildren = Object.keys(node.children).length > 0

                    return (
                        <div key={currentPath} className="group/topic">
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 pl-2 sm:pl-4 hover:bg-zinc-800/40 transition-colors ${hasChildren ? 'cursor-pointer' : ''}`}
                                onClick={() => hasChildren && toggleTopic(currentPath)}
                            >
                                <div className="flex items-start sm:items-center gap-2 sm:gap-3 w-full sm:flex-1 pr-0 sm:pr-2 mb-2 sm:mb-0">
                                    {hasChildren ? (
                                        <button className={`p-1 rounded hover:bg-zinc-700/50 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} flex-shrink-0 mt-0.5 sm:mt-0`}>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    ) : (
                                        <div className="w-5" /> /* spacer */
                                    )}
                                    <BookOpen className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                                    <span className={`text-sm ${hasChildren ? 'font-medium text-zinc-300' : 'text-zinc-400'} whitespace-normal break-words leading-tight`}>{node.name}</span>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-4 w-full sm:w-auto pl-8 sm:pl-0">
                                    <StatsDisplay stats={node.stats} />

                                    <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover/topic:opacity-100 transition-opacity w-[60px] sm:w-[72px] justify-end">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onStudy(discId, subId || 'all', node.topicIds)
                                            }}
                                            className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                                            title="Estudar Assunto"
                                        >
                                            <Play className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete(null, null, node.topicIds)
                                            }}
                                            className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg transition-colors"
                                            title="Excluir Assunto"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {isExpanded && hasChildren && (
                                <TopicTreeRender
                                    nodes={node.children}
                                    basePath={currentPath}
                                    level={level + 1}
                                    discId={discId}
                                    subId={subId}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden shadow-sm">
            <ListHeader />
            <div className="divide-y divide-zinc-800/50">
                {hierarchy.map(discNode => {
                    const isExpanded = expandedDisciplines.includes(discNode.discipline.id)

                    return (
                        <div key={discNode.discipline.id} className="group/disc transition-colors hover:bg-zinc-800/20">
                            {/* Discipline Row */}
                            <div
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 cursor-pointer"
                                onClick={() => toggleDiscipline(discNode.discipline.id)}
                            >
                                <div className="flex items-start sm:items-center gap-2 sm:gap-3 w-full sm:flex-1 pr-0 sm:pr-2 mb-2 sm:mb-0">
                                    <button
                                        className={`p-1 rounded hover:bg-zinc-700/50 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} flex-shrink-0 mt-0.5 sm:mt-0`}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <Folder className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                                    <span className="font-semibold text-zinc-200 whitespace-normal break-words leading-tight">{discNode.discipline.name}</span>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-4 w-full sm:w-auto pl-8 sm:pl-0">
                                    <StatsDisplay stats={discNode.stats} />

                                    <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover/disc:opacity-100 transition-opacity w-[60px] sm:w-[72px] justify-end">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onStudy(discNode.discipline.id, 'all', 'all')
                                            }}
                                            className="p-1.5 sm:p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                                            title="Estudar Disciplina"
                                        >
                                            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete(discNode.discipline.id, null, null)
                                            }}
                                            className="p-1.5 sm:p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg transition-colors"
                                            title="Excluir Baralho"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Subdisciplines & Direct Topics */}
                            {isExpanded && (
                                <div className="bg-zinc-900/30 border-l-2 border-zinc-800 ml-5">
                                    {/* Direct Topics */}
                                    <TopicTreeRender
                                        nodes={discNode.topicTree}
                                        basePath={`disc_${discNode.discipline.id}`}
                                        level={0}
                                        discId={discNode.discipline.id}
                                        subId={null}
                                    />

                                    {/* Subdisciplines */}
                                    {Object.values(discNode.subdisciplines).map(subNode => {
                                        const isSubExpanded = expandedSubdisciplines.includes(subNode.subdiscipline.id)

                                        return (
                                            <div key={subNode.subdiscipline.id} className="group/sub">
                                                <div
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 pl-2 sm:pl-4 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                                                    onClick={() => toggleSubdiscipline(subNode.subdiscipline.id)}
                                                >
                                                    <div className="flex items-start sm:items-center gap-2 sm:gap-3 w-full sm:flex-1 pr-0 sm:pr-2 mb-2 sm:mb-0">
                                                        <button
                                                            className={`p-1 rounded hover:bg-zinc-700/50 text-zinc-500 transition-transform duration-200 ${isSubExpanded ? 'rotate-90' : ''} flex-shrink-0 mt-0.5 sm:mt-0`}
                                                        >
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        </button>
                                                        <Layers className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                                                        <span className="text-sm font-medium text-zinc-300 whitespace-normal break-words leading-tight">{subNode.subdiscipline.name}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-4 w-full sm:w-auto pl-8 sm:pl-0">
                                                        <StatsDisplay stats={subNode.stats} />

                                                        <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity w-[60px] sm:w-[72px] justify-end">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    onStudy(discNode.discipline.id, subNode.subdiscipline.id, 'all')
                                                                }}
                                                                className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                                                                title="Estudar Subdisciplina"
                                                            >
                                                                <Play className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    onDelete(null, subNode.subdiscipline.id, null)
                                                                }}
                                                                className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg transition-colors"
                                                                title="Excluir Subdisciplina"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Topics Tree */}
                                                {isSubExpanded && (
                                                    <TopicTreeRender
                                                        nodes={subNode.topicTree}
                                                        basePath={`sub_${subNode.subdiscipline.id}`}
                                                        level={1}
                                                        discId={discNode.discipline.id}
                                                        subId={subNode.subdiscipline.id}
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
