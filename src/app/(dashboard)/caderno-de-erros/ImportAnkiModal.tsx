'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import {
    X,
    Upload,
    Check,
    AlertTriangle,
    Loader2,
    Download,
    Layers,
    Plus
} from 'lucide-react'
import { toast } from 'sonner'

type Discipline = Database['public']['Tables']['disciplines']['Row']
type Subdiscipline = Database['public']['Tables']['subdisciplines']['Row']
type Topic = Database['public']['Tables']['topics']['Row']

interface ParsedCard {
    id: number
    question: string
    answer: string
    selected: boolean
    deckName: string
    // Path broken down: TopDeck :: Discipline :: Subdiscipline :: Topic
    path: string[]
}

interface ImportAnkiModalProps {
    isOpen: boolean
    onClose: () => void
    disciplines: Discipline[]
    onImportComplete: () => void
}

export function ImportAnkiModal({ isOpen, onClose, disciplines, onImportComplete }: ImportAnkiModalProps) {
    const supabase = createClient()

    const [parsing, setParsing] = useState(false)
    const [importing, setImporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [progressMsg, setProgressMsg] = useState('')
    // 3 steps: upload -> map -> preview
    const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload')

    const [parsedCards, setParsedCards] = useState<ParsedCard[]>([])
    const [mediaMap, setMediaMap] = useState<Record<string, Blob>>({})
    const [selectedCards, setSelectedCards] = useState<boolean[]>([])

    // Extracted unique Anki hierarchy
    const [ankiDisciplines, setAnkiDisciplines] = useState<string[]>([])
    const [ankiSubdisciplines, setAnkiSubdisciplines] = useState<string[]>([])

    // Active Database categories
    const [dbDisciplines, setDbDisciplines] = useState<Discipline[]>(disciplines)
    const [dbSubdisciplines, setDbSubdisciplines] = useState<Subdiscipline[]>([])

    // Mappings: "Anki Name" -> DB ID (or 'create_new')
    const [disciplineMapping, setDisciplineMapping] = useState<Record<string, number | 'create_new'>>({})
    const [subdisciplineMapping, setSubdisciplineMapping] = useState<Record<string, number | 'create_new'>>({})

    // UI Optimization for large decks (50k+ cards)
    const [visibleCount, setVisibleCount] = useState(50)

    // Clear state when closed
    useEffect(() => {
        if (!isOpen) {
            setStep('upload')
            setParsedCards([])
            setMediaMap({})
            setSelectedCards([])
            setVisibleCount(50)
            setAnkiDisciplines([])
            setAnkiSubdisciplines([])
            setDisciplineMapping({})
            setSubdisciplineMapping({})
        }
    }, [isOpen])

    // Load available global subdisciplines
    useEffect(() => {
        if (isOpen) {
            supabase.from('subdisciplines').select('*').then(({ data }) => {
                if (data) setDbSubdisciplines(data)
            })
            setDbDisciplines(disciplines)
        }
    }, [isOpen, disciplines, supabase])

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.apkg')) {
            toast.error('Por favor, selecione um arquivo Anki válido (.apkg)')
            return
        }

        setParsing(true)
        try {
            const zip = await JSZip.loadAsync(file)

            // 1. Read SQLite DB
            let sqliteFile = zip.file('collection.anki21') || zip.file('collection.anki2')
            if (!sqliteFile) throw new Error('O arquivo não parece ser um deck Anki válido.')

            const sqliteData = await sqliteFile.async('uint8array')

            // Magic string check
            const textDecoder = new TextDecoder()
            const peekText = textDecoder.decode(sqliteData.slice(0, 50))
            if (peekText.includes('Please update to the latest Anki')) {
                throw new Error('Formato de exportação do Anki não suportado. Tente exportar desmarcando "Support older Anki versions".')
            }

            // 2. Read Media json to map ids to actual filenames
            const mediaFile = zip.file('media')
            let mediaJson: Record<string, string> = {}
            if (mediaFile) {
                try {
                    const mediaConfig = await mediaFile.async('string')
                    mediaJson = JSON.parse(mediaConfig.trim())
                } catch (e) {
                    console.error('Media JSON parse failed:', e)
                    toast.error('Aviso: Mídia não reconhecida. Imagens podem não carregar.')
                }
            }

            // 3. Extract media files
            const mMap: Record<string, Blob> = {}
            for (const [key, filename] of Object.entries(mediaJson)) {
                const fileInZip = zip.file(key)
                if (fileInZip) {
                    const blob = await fileInZip.async('blob')
                    mMap[filename] = blob
                }
            }
            setMediaMap(mMap)

            // 4. Initialize SQL.js and parse DB
            const SQL = await initSqlJs({
                locateFile: file => `/${file}`
            })
            const db = new SQL.Database(sqliteData)

            // Get decks from col
            const colResult = db.exec('SELECT decks FROM col')
            if (colResult.length === 0) throw new Error('Falha ao ler coleção de decks.')
            const decksJson = JSON.parse(colResult[0].values[0][0] as string)
            const deckMap: Record<number, string> = {}
            for (const d of Object.values(decksJson)) {
                const deck = d as any
                deckMap[deck.id] = deck.name
            }

            // Get cards (we join cards with notes to get the deck id)
            // c.did = deck id, c.nid = note id, n.flds = fields
            const result = db.exec(`
                SELECT c.id, c.did, n.flds 
                FROM cards c 
                JOIN notes n ON c.nid = n.id
                WHERE c.queue != -1
            `)

            if (result.length === 0) {
                toast.error('Nenhum flashcard encontrado no baralho.')
                setParsing(false)
                return
            }

            const cards: ParsedCard[] = []
            const uniqueAnkiDisc = new Set<string>()
            const uniqueAnkiSub = new Set<string>()

            for (const row of result[0].values) {
                const id = row[0] as number
                const did = row[1] as number
                const flds = row[2] as string
                const fields = flds.split('\x1f')
                const front = fields[0] || ''
                const back = fields[1] || ''

                if (result[0].values.length === 1 && front.includes('Please update to the latest Anki version')) {
                    throw new Error('Você exportou usando o novo padrão fechado do Anki. Por favor, exporte marcando "Support older Anki versions".')
                }

                const deckName = deckMap[did] || 'Geral'
                // example: Flashcards Osler 2024::Clínica Cirúrgica::Trauma
                const path = deckName.split('::').map(s => s.trim())

                // Strategy: 
                // path[0] = TopDeck (ignore)
                // path[1] = Discipline
                // path[2] = Subdiscipline
                // path[3] = Topic
                const disc = path.length > 1 ? path[1] : 'Geral'
                const sub = path.length > 2 ? path[2] : 'Geral'

                uniqueAnkiDisc.add(disc)
                uniqueAnkiSub.add(`${disc}::-::${sub}`) // Composite key for grouping subdisciplines

                cards.push({ id, question: front, answer: back, selected: true, deckName, path })
            }

            setParsedCards(cards)
            setSelectedCards(cards.map(() => true))
            setVisibleCount(50)

            setAnkiDisciplines(Array.from(uniqueAnkiDisc))
            setAnkiSubdisciplines(Array.from(uniqueAnkiSub))

            // Auto-map if exact name match exists
            const initialDiscMap: Record<string, number | 'create_new'> = {}
            Array.from(uniqueAnkiDisc).forEach(ankiName => {
                const match = disciplines.find(d => d.name.toLowerCase() === ankiName.toLowerCase())
                initialDiscMap[ankiName] = match ? match.id : 'create_new'
            })
            setDisciplineMapping(initialDiscMap)

            // We do a similar auto-map for subdisciplines in the useEffect or when changing discipline mapping
            setStep('map')

        } catch (error: any) {
            console.error('Anki Parse Error:', error)
            toast.error(error.message || 'Erro ao ler o arquivo .apkg')
        } finally {
            setParsing(false)
            e.target.value = ''
        }
    }

    // Auto-map subdisciplines when mapping changes
    useEffect(() => {
        if (step !== 'map') return

        const newSubMap = { ...subdisciplineMapping }
        ankiSubdisciplines.forEach(combo => {
            const [ankiDisc, ankiSub] = combo.split('::-::')
            const mappedDiscId = disciplineMapping[ankiDisc]

            if (!newSubMap[combo] && typeof mappedDiscId === 'number') {
                const match = dbSubdisciplines.find(s => s.discipline_id === mappedDiscId && s.name.toLowerCase() === ankiSub.toLowerCase())
                newSubMap[combo] = match ? match.id : 'create_new'
            } else if (!newSubMap[combo]) {
                newSubMap[combo] = 'create_new'
            }
        })
        setSubdisciplineMapping(newSubMap)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disciplineMapping, ankiSubdisciplines, dbSubdisciplines, step])


    // Helpers
    function toggleCard(index: number) {
        setSelectedCards(prev => prev.map((v, i) => i === index ? !v : v))
    }

    function toggleAll() {
        const allSelected = selectedCards.every(v => v)
        setSelectedCards(selectedCards.map(() => !allSelected))
    }

    async function uploadMediaFile(filename: string, userId: string): Promise<string | null> {
        const blob = mediaMap[filename]
        if (!blob) return null

        const fileExt = filename.split('.').pop()
        const storageName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage.from('error-notebook').upload(storageName, blob)
        if (uploadError) return null

        const { data: { publicUrl } } = supabase.storage.from('error-notebook').getPublicUrl(storageName)
        return publicUrl
    }

    async function executeImport() {
        const cardsToImport = parsedCards.filter((_, i) => selectedCards[i])
        if (cardsToImport.length === 0) {
            toast.error('Selecione pelo menos um flashcard para importar.')
            return
        }

        setImporting(true)
        setProgress(0)
        setProgressMsg('Mapeando categorias...')
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não autenticado.')

            // 1. Process mappings - Create new disciplines and subdisciplines if needed
            const finalDiscIds: Record<string, number> = {}
            for (const [ankiName, mapValue] of Object.entries(disciplineMapping)) {
                if (mapValue === 'create_new') {
                    // Check if exists first to avoid conflict
                    const { data: existing } = await supabase.from('disciplines').select('id').ilike('name', ankiName).maybeSingle()
                    if (existing) {
                        finalDiscIds[ankiName] = existing.id
                    } else {
                        const { data, error } = await supabase.from('disciplines').insert({ name: ankiName }).select('id').single()
                        if (error) throw error
                        finalDiscIds[ankiName] = data.id
                    }
                } else {
                    finalDiscIds[ankiName] = mapValue
                }
            }

            const finalSubIds: Record<string, number> = {} // maps "DiscName::-::SubName" -> ID
            for (const [combo, mapValue] of Object.entries(subdisciplineMapping)) {
                const [ankiDisc, ankiSub] = combo.split('::-::')
                const discId = finalDiscIds[ankiDisc]

                if (mapValue === 'create_new') {
                    // Check if exists
                    const { data: existing } = await supabase.from('subdisciplines')
                        .select('id').eq('discipline_id', discId).ilike('name', ankiSub).maybeSingle()

                    if (existing) {
                        finalSubIds[combo] = existing.id
                    } else {
                        const { data, error } = await supabase.from('subdisciplines')
                            .insert({ name: ankiSub, discipline_id: discId }).select('id').single()
                        if (error) throw error
                        finalSubIds[combo] = data.id
                    }
                } else {
                    finalSubIds[combo] = mapValue
                }
            }

            // Topics will be auto-created to simplify
            const topicCache: Record<string, number> = {} // subId-topicName -> ID

            setProgress(10)
            setProgressMsg('Processando flashcards e mídias...')

            // 2. Prepare payload
            const payload = []
            let processedCards = 0
            const totalCards = cardsToImport.length

            for (const card of cardsToImport) {
                let qText = card.question
                let aText = card.answer
                const imageUrls: string[] = []

                const processMedia = async (text: string) => {
                    let pt = text
                    const matches = [...text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
                    for (const match of matches) {
                        const filename = match[1]
                        if (mediaMap[filename]) {
                            const publicUrl = await uploadMediaFile(filename, user.id)
                            if (publicUrl) {
                                pt = pt.replace(match[0], `<img src="${publicUrl}" class="max-w-full rounded-lg my-2" />`)
                                imageUrls.push(publicUrl)
                            }
                        }
                    }
                    return pt
                }

                qText = await processMedia(qText)
                aText = await processMedia(aText)

                const ankiDisc = card.path.length > 1 ? card.path[1] : 'Geral'
                const ankiSub = card.path.length > 2 ? card.path[2] : 'Geral'
                const topicName = card.path.length > 3 ? card.path.slice(3).join(' > ') : null

                const finalDiscId = finalDiscIds[ankiDisc]
                const finalSubId = finalSubIds[`${ankiDisc}::-::${ankiSub}`]
                let finalTopicId = null

                if (topicName && finalSubId) {
                    const cacheKey = `${finalSubId}-${topicName}`
                    if (topicCache[cacheKey]) {
                        finalTopicId = topicCache[cacheKey]
                    } else {
                        // Check if exists
                        const { data: existing } = await supabase.from('topics')
                            .select('id').eq('subdiscipline_id', finalSubId).eq('name', topicName).maybeSingle()

                        if (existing) {
                            finalTopicId = existing.id
                            topicCache[cacheKey] = existing.id
                        } else {
                            const { data: created, error } = await supabase.from('topics')
                                .insert({ name: topicName, subdiscipline_id: finalSubId }).select('id').single()
                            if (!error && created) {
                                finalTopicId = created.id
                                topicCache[cacheKey] = created.id
                            }
                        }
                    }
                }


                payload.push({
                    user_id: user.id,
                    discipline_id: finalDiscId,
                    subdiscipline_id: finalSubId,
                    topic_id: finalTopicId,
                    question_text: qText,
                    answer_text: aText,
                    notes: `Importado do Baralho: ${card.deckName}`,
                    image_urls: imageUrls.length > 0 ? imageUrls : null,
                })

                processedCards++
                if (processedCards % 5 === 0 || processedCards === totalCards) {
                    // Update progress from 10% to 80% (70% space)
                    setProgress(10 + Math.floor((processedCards / totalCards) * 70))
                }
            }

            setProgress(80)
            setProgressMsg('Salvando no banco de dados...')

            // 3. Batch insert in chunks of 500 to avoid request limits
            const chunkSize = 500
            const totalChunks = Math.ceil(payload.length / chunkSize)
            for (let i = 0; i < payload.length; i += chunkSize) {
                const chunk = payload.slice(i, i + chunkSize)
                const { error } = await supabase.from('error_notebook').insert(chunk)
                if (error) throw error

                const currentChunk = Math.floor(i / chunkSize) + 1
                // Update progress from 80% to 100% (20% space)
                setProgress(80 + Math.floor((currentChunk / totalChunks) * 20))
            }

            toast.success(`${payload.length} flashcards importados com sucesso!`)
            onClose()
            onImportComplete()

        } catch (error: any) {
            console.error('Error importing:', error)
            toast.error('Erro ao importar: ' + (error.message || 'Erro desconhecido'))
        } finally {
            setImporting(false)
        }
    }


    const selectedCount = selectedCards.filter(v => v).length

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 100 }}>
            <div className="bg-[#09090b] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl shadow-blue-500/5 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Download className="w-5 h-5 text-blue-400" />
                        Importar do Anki (.apkg)
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors bg-white/5 p-1 rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {step === 'upload' && (
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-white">1. Faça o upload do arquivo</h3>
                                <p className="text-sm text-zinc-400">Exporte seu baralho selecionado na versão desktop do Anki (com fotos e mídia). Marque a opção "Support older Anki versions" se estiver no Anki 2.1.66+.</p>
                            </div>
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700/50 rounded-2xl bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-blue-500/50 transition-all cursor-pointer group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {parsing ? (
                                        <Loader2 className="w-10 h-10 text-blue-400 mb-3 animate-spin" />
                                    ) : (
                                        <Upload className="w-10 h-10 text-zinc-500 group-hover:text-blue-400 transition-colors mb-3" />
                                    )}
                                    <p className="mb-2 text-sm text-zinc-400">
                                        <span className="font-semibold text-zinc-300">Clique para fazer upload</span>
                                    </p>
                                    <p className="text-xs text-zinc-500">Somente arquivos Anki (.apkg) até 100MB.</p>
                                </div>
                                <input type="file" className="hidden" accept=".apkg" onChange={handleFileUpload} disabled={parsing} />
                            </label>
                        </div>
                    )}

                    {step === 'map' && (
                        <div className="p-6 space-y-8">
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-blue-400" />
                                    Mapeamento de Categoria
                                </h3>
                                <p className="text-sm text-zinc-400">
                                    Encontramos as seguintes estruturas de baralhos no arquivo. Escolha se deseja fundir com uma disciplina/subdisciplina existente ou criar uma nova.
                                    Os tópicos serão criados automaticamente com base na hierarquia do baralho.
                                </p>
                            </div>

                            <div className="space-y-6">
                                {ankiDisciplines.map(ankiDisc => (
                                    <div key={ankiDisc} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 space-y-4">
                                        {/* Discipline Row */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                                            <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                                                <Layers className="w-4 h-4" />
                                                <span>{ankiDisc}</span>
                                                <span className="text-xs text-zinc-500 font-normal uppercase px-2 bg-white/5 rounded-full">Disciplina Anki</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-zinc-500">→</span >
                                                <select
                                                    value={disciplineMapping[ankiDisc]}
                                                    onChange={e => setDisciplineMapping(p => ({ ...p, [ankiDisc]: e.target.value === 'create_new' ? 'create_new' : Number(e.target.value) }))}
                                                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none w-56"
                                                >
                                                    <option className="text-emerald-400 font-bold" value="create_new">+ Criar Nova Disciplina</option>
                                                    <optgroup label="Disciplinas Mapeadas">
                                                        {dbDisciplines.map(d => (
                                                            <option key={d.id} value={d.id}>{d.name}</option>
                                                        ))}
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Subdisciplines for this discipline */}
                                        <div className="space-y-3 pl-8">
                                            {ankiSubdisciplines.filter(s => s.startsWith(`${ankiDisc}::-::`)).map(combo => {
                                                const [, ankiSub] = combo.split('::-::')
                                                const mappedDiscId = disciplineMapping[ankiDisc]
                                                const availableSubs = typeof mappedDiscId === 'number'
                                                    ? dbSubdisciplines.filter(s => s.discipline_id === mappedDiscId)
                                                    : []

                                                return (
                                                    <div key={combo} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-2 text-zinc-300 text-sm">
                                                            <span>• {ankiSub}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-zinc-600">→</span >
                                                            <select
                                                                value={subdisciplineMapping[combo]}
                                                                onChange={e => setSubdisciplineMapping(p => ({ ...p, [combo]: e.target.value === 'create_new' ? 'create_new' : Number(e.target.value) }))}
                                                                className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none w-56"
                                                            >
                                                                <option className="text-emerald-400 font-bold" value="create_new">+ Criar Nova Subdisciplina</option>
                                                                {availableSubs.length > 0 && (
                                                                    <optgroup label="Corresponder à Existente">
                                                                        {availableSubs.map(s => (
                                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </select>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-zinc-400">
                                    <span className="text-white font-bold">{selectedCount}</span> de {parsedCards.length} card{parsedCards.length !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
                                </p>
                                <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                                    {selectedCards.every(v => v) ? 'Desmarcar todos' : 'Selecionar todos'}
                                </button>
                            </div>

                            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 pb-4">
                                {parsedCards.slice(0, visibleCount).map((card, i) => (
                                    <div
                                        key={i}
                                        onClick={() => toggleCard(i)}
                                        className={`relative rounded-xl border p-4 cursor-pointer transition-all ${selectedCards[i] ? 'bg-blue-500/5 border-blue-500/25 shadow-lg shadow-blue-500/5' : 'bg-zinc-900/30 border-zinc-800/40 opacity-50'}`}
                                    >
                                        <div className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedCards[i] ? 'bg-blue-500 border-blue-500' : 'border-zinc-600 bg-transparent'}`}>
                                            {selectedCards[i] && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            {card.path.slice(1).map((segment, idx) => (
                                                <span key={idx} className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5">
                                                    {segment}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="text-sm text-zinc-200 font-medium mt-1 pr-8 line-clamp-3 overflow-hidden text-ellipsis [&>img]:hidden" dangerouslySetInnerHTML={{ __html: card.question }} />
                                        <div className="text-xs text-zinc-500 mt-1.5 line-clamp-3 leading-relaxed [&>img]:hidden" dangerouslySetInnerHTML={{ __html: card.answer }} />
                                    </div>
                                ))}

                                {visibleCount < parsedCards.length && (
                                    <button onClick={() => setVisibleCount(p => Math.min(p + 100, parsedCards.length))} className="w-full py-3 mt-4 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                        Carregar mais resultados ({parsedCards.length - visibleCount} restantes)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex justify-end items-center bg-zinc-900/30 flex-shrink-0">
                    {step === 'map' && (
                        <div className="flex gap-3">
                            <button onClick={() => setStep('upload')} className="px-4 py-2.5 text-zinc-400 hover:text-white font-medium">Cancelar</button>
                            <button onClick={() => setStep('preview')} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold flex items-center gap-2">
                                Continuar <Check className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {step === 'preview' && (
                        <div className="flex flex-col w-full gap-3">
                            {importing && (
                                <div className="w-full space-y-1.5 px-1 py-1">
                                    <div className="flex justify-between text-xs text-zinc-400 font-medium">
                                        <span>{progressMsg}</span>
                                        <span className="font-mono">{progress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 w-full">
                                <button onClick={() => setStep('map')} disabled={importing} className="px-4 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors disabled:opacity-50">← Voltar</button>
                                <button onClick={executeImport} disabled={importing || selectedCount === 0} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4" /> Confirmar ({selectedCount})</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
