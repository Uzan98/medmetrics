'use client'

import { useState } from 'react'
import {
    BookOpen,
    Layers,
    TrendingUp,
    Target,
    Tags,
    FileText
} from 'lucide-react'
import DisciplinasTab from './components/DisciplinasTab'
import SubdisciplinasTab from './components/SubdisciplinasTab'
import EvolucaoTab from './components/EvolucaoTab'
import MetasTab from './components/MetasTab'
import AssuntosTab from './components/AssuntosTab'
import ProvasTab from './components/ProvasTab'

type Tab = 'disciplinas' | 'subdisciplinas' | 'assuntos' | 'evolucao' | 'metas' | 'provas'

export default function MetricasPage() {
    const [activeTab, setActiveTab] = useState<Tab>('disciplinas')

    const tabs = [
        { id: 'disciplinas', label: 'Disciplinas', icon: BookOpen },
        { id: 'subdisciplinas', label: 'Subdisciplinas', icon: Layers },
        { id: 'assuntos', label: 'Assuntos', icon: Tags },
        { id: 'provas', label: 'Provas na Íntegra', icon: FileText },
        { id: 'evolucao', label: 'Evolução', icon: TrendingUp },
        { id: 'metas', label: 'Metas', icon: Target },
    ]

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-white">Métricas</h1>
                <p className="text-slate-400">Analise seu desempenho detalhado em todas as áreas</p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex space-x-1 rounded-xl bg-slate-900/50 p-1 border border-slate-700/50 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all min-w-[140px] justify-center
                                ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
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
                {activeTab === 'metas' && <MetasTab />}
            </div>
        </div>
    )
}
