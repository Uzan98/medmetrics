'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function RecuperarSenhaPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/redefinir-senha`,
            })

            if (error) throw error
            setSuccess(true)
        } catch (err) {
            setError('Não foi possível enviar o email. Verifique o endereço e tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{
            background: 'linear-gradient(135deg, #09090b 0%, #1e1b4b 50%, #09090b 100%)'
        }}>
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
                        <Mail className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Recuperar Senha</h1>
                    <p className="text-zinc-400 mt-2">
                        Digite seu email para receber o link de recuperação
                    </p>
                </div>

                {/* Card */}
                <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/50">
                    {success ? (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Email enviado!</h2>
                            <p className="text-zinc-400 mb-6">
                                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Voltar para o login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Mail className="w-5 h-5" />
                                        Enviar Link de Recuperação
                                    </>
                                )}
                            </button>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Voltar para o login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
