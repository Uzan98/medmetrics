'use client'

import { useState } from 'react'
import {
    BarChart3,
    TrendingUp,
    Target,
    FileText,
} from 'lucide-react'
import DesempenhoTab from './components/DesempenhoTab'
import EvolucaoUnifiedTab from './components/EvolucaoUnifiedTab'
import ProvasTab from './components/ProvasTab'
import MetasTab from './components/MetasTab'
import FocoSugerido from './components/FocoSugerido'

type Tab = 'desempenho' | 'evolucao' | 'provas' | 'metas'

export default function MetricasPage() {
    const [activeTab, setActiveTab] = useState<Tab>('desempenho')

    const tabs = [
        { id: 'desempenho', label: 'Desempenho', icon: BarChart3 },
        { id: 'evolucao', label: 'Evolução', icon: TrendingUp },
        { id: 'provas', label: 'Provas', icon: FileText },
        { id: 'metas', label: 'Metas', icon: Target },
    ]

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-white">Métricas</h1>
                <p className="text-zinc-400">Analise seu desempenho detalhado em todas as áreas</p>
            </div>

            {/* Focus Suggestions */}
            <FocoSugerido />

            {/* Tabs Navigation */}
            <div className="flex space-x-1 rounded-full bg-zinc-900/30 backdrop-blur-md p-1.5 border border-white/5 overflow-x-auto scrollbar-none snap-x sticky top-0 z-20">
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
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-white'}`} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {activeTab === 'desempenho' && <DesempenhoTab />}
                {activeTab === 'evolucao' && <EvolucaoUnifiedTab />}
                {activeTab === 'provas' && <ProvasTab />}
                {activeTab === 'metas' && <MetasTab />}
            </div>
        </div>
    )
}
