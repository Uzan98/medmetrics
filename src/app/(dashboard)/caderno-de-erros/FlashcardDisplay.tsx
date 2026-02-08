'use client'

import { useState, useEffect } from 'react'
import { BookOpen, RotateCcw, Check, BrainCircuit, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface FlashcardDisplayProps {
    question: string
    answer: string
    notes?: string | null
    discipline?: string | null
    topic?: string | null
    images?: string[] | null
    errorType?: string | null
    actionItem?: string | null
    isFlipped: boolean
    onFlip: () => void
    accentColor?: string
}

export function FlashcardDisplay({
    question,
    answer,
    notes,
    discipline,
    topic,
    images,
    errorType,
    actionItem,
    isFlipped,
    onFlip,
    accentColor = 'indigo'
}: FlashcardDisplayProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    // Color mapping
    const colorMap: Record<string, { gradient: string; glow: string; badge: string; border: string }> = {
        amber: {
            gradient: 'from-amber-500 to-orange-600',
            glow: 'shadow-amber-500/30',
            badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            border: 'border-amber-500/30'
        },
        emerald: {
            gradient: 'from-emerald-500 to-teal-600',
            glow: 'shadow-emerald-500/30',
            badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            border: 'border-emerald-500/30'
        },
        cyan: {
            gradient: 'from-cyan-500 to-blue-600',
            glow: 'shadow-cyan-500/30',
            badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
            border: 'border-cyan-500/30'
        },
        pink: {
            gradient: 'from-pink-500 to-rose-600',
            glow: 'shadow-pink-500/30',
            badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
            border: 'border-pink-500/30'
        },
        violet: {
            gradient: 'from-violet-500 to-purple-600',
            glow: 'shadow-violet-500/30',
            badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
            border: 'border-violet-500/30'
        },
        indigo: {
            gradient: 'from-indigo-500 to-blue-600',
            glow: 'shadow-indigo-500/30',
            badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
            border: 'border-indigo-500/30'
        }
    }

    const colors = colorMap[accentColor] || colorMap.indigo

    return (
        <>
            <div className="w-full max-w-2xl mx-auto perspective-1000">
                <div
                    onClick={onFlip}
                    className={`
                        relative w-full min-h-[400px] cursor-pointer
                        transition-all duration-700 transform-style-3d
                        ${isFlipped ? 'rotate-y-180' : ''}
                    `}
                    style={{
                        transformStyle: 'preserve-3d',
                        perspective: '1000px'
                    }}
                >
                    {/* Front - Question */}
                    <div
                        className={`
                            absolute inset-0 backface-hidden
                            bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
                            rounded-3xl p-8 flex flex-col
                            border-2 ${colors.border}
                            shadow-2xl ${colors.glow}
                            ${isFlipped ? 'invisible' : ''}
                        `}
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg ${colors.glow}`}>
                                    <BookOpen className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    {discipline && (
                                        <p className="font-bold text-white text-lg">{discipline}</p>
                                    )}
                                    {topic && (
                                        <span className={`text-xs px-2 py-0.5 rounded-lg border ${colors.badge}`}>
                                            {topic}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">
                                Pergunta
                            </div>
                        </div>

                        {/* Question */}
                        <div className="flex-1 flex items-center justify-center">
                            <h2 className="text-2xl md:text-3xl font-bold text-white text-center leading-relaxed">
                                {question}
                            </h2>
                        </div>

                        {/* Images Preview */}
                        {images && images.length > 0 && (
                            <div className="flex gap-2 justify-center mt-6">
                                {images.slice(0, 3).map((url, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => { e.stopPropagation(); setSelectedImage(url); }}
                                        className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white/20 hover:border-white/50 transition-all hover:scale-110"
                                    >
                                        <Image src={url} alt="" fill className="object-cover" />
                                    </button>
                                ))}
                                {images.length > 3 && (
                                    <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold">
                                        +{images.length - 3}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tap hint */}
                        <div className="text-center mt-6">
                            <p className="text-slate-400 text-sm animate-pulse">
                                Toque para revelar a resposta
                            </p>
                        </div>
                    </div>

                    {/* Back - Answer */}
                    <div
                        className={`
                            absolute inset-0 backface-hidden
                            bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900
                            rounded-3xl p-8 flex flex-col overflow-y-auto
                            border-2 border-emerald-500/30
                            shadow-2xl shadow-emerald-500/20
                            ${!isFlipped ? 'invisible' : ''}
                        `}
                        style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)'
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <Check className="w-6 h-6 text-white" />
                                </div>
                                <span className="font-bold text-emerald-400 text-lg">Resposta Correta</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onFlip(); }}
                                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                            >
                                <RotateCcw className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Answer */}
                        <div className="flex-1">
                            <p className="text-xl text-white leading-relaxed whitespace-pre-line">
                                {answer}
                            </p>

                            {/* Notes */}
                            {notes && (
                                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                                    <div className="flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-wider mb-2">
                                        <BrainCircuit className="w-4 h-4" />
                                        Anotações
                                    </div>
                                    <p className="text-amber-100/80 italic">{notes}</p>
                                </div>
                            )}

                            {/* Error Type & Action */}
                            {(errorType || actionItem) && (
                                <div className="mt-4 p-4 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-3">
                                    {errorType && (
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-1">
                                                Diagnóstico
                                            </span>
                                            <span className={`
                                                inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold
                                                ${errorType === 'knowledge_gap' ? 'bg-red-500/20 text-red-300' :
                                                    errorType === 'interpretation' ? 'bg-orange-500/20 text-orange-300' :
                                                        errorType === 'distraction' ? 'bg-yellow-500/20 text-yellow-300' :
                                                            'bg-blue-500/20 text-blue-300'}
                                            `}>
                                                {errorType === 'knowledge_gap' && 'Lacuna de Conteúdo'}
                                                {errorType === 'interpretation' && 'Falha de Interpretação'}
                                                {errorType === 'distraction' && 'Falta de Atenção'}
                                                {errorType === 'reasoning' && 'Raciocínio Incorreto'}
                                            </span>
                                        </div>
                                    )}
                                    {actionItem && (
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-1">
                                                Ação Futura
                                            </span>
                                            <p className="text-indigo-300 font-medium">→ {actionItem}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <Image
                        src={selectedImage}
                        alt=""
                        width={1200}
                        height={800}
                        className="object-contain max-h-[90vh] rounded-lg"
                    />
                </div>
            )}

            {/* CSS for 3D transforms */}
            <style jsx global>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
                .transform-style-3d {
                    transform-style: preserve-3d;
                }
                .backface-hidden {
                    backface-visibility: hidden;
                }
                .rotate-y-180 {
                    transform: rotateY(180deg);
                }
            `}</style>
        </>
    )
}
