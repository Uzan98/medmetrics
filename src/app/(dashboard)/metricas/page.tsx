'use client'

import { useState } from 'react'
import {
    BookOpen,
    Layers,
    TrendingUp,
    Target,
    Tags,
    FileText,
    Calendar
} from 'lucide-react'
import DisciplinasTab from './components/DisciplinasTab'
import SubdisciplinasTab from './components/SubdisciplinasTab'
import EvolucaoTab from './components/EvolucaoTab'
import MetasTab from './components/MetasTab'
import AssuntosTab from './components/AssuntosTab'
import ProvasTab from './components/ProvasTab'
import EvolucaoDiariaTab from './components/EvolucaoDiariaTab'

type Tab = 'disciplinas' | 'subdisciplinas' | 'assuntos' | 'evolucao' | 'evolucao-diaria' | 'metas' | 'provas'

export default function MetricasPage() {
    const [activeTab, setActiveTab] = useState<Tab>('disciplinas')

    const tabs = [
        { id: 'disciplinas', label: 'Disciplinas', icon: BookOpen },
        { id: 'subdisciplinas', label: 'Subdisciplinas', icon: Layers },
        { id: 'assuntos', label: 'Assuntos', icon: Tags },
        { id: 'provas', label: 'Provas na Íntegra', icon: FileText },
        { id: 'evolucao', label: 'Evolução Mensal', icon: TrendingUp },
        { id: 'evolucao-diaria', label: 'Evolução Diária', icon: Calendar },
        { id: 'metas', label: 'Metas', icon: Target },
    ]

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-white">Métricas</h1>
                <p className="text-slate-400">Analise seu desempenho detalhado em todas as áreas</p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex space-x-1 rounded-full bg-slate-900/30 backdrop-blur-md p-1.5 border border-white/5 overflow-x-auto scrollbar-none snap-x sticky top-0 z-20">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`
                                flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all whitespace-nowrap snap-center
                                ${isActive
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {activeTab === 'disciplinas' && <DisciplinasTab />}
                {activeTab === 'subdisciplinas' && <SubdisciplinasTab />}
                {activeTab === 'assuntos' && <AssuntosTab />}
                {activeTab === 'provas' && <ProvasTab />}
                {activeTab === 'evolucao' && <EvolucaoTab />}
                {activeTab === 'evolucao-diaria' && <EvolucaoDiariaTab />}
                {activeTab === 'metas' && <MetasTab />}
            </div>
        </div>
    )
}
