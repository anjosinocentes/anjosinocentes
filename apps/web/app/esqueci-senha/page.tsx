"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"
import { forgotPasswordRequest } from "@/lib/auth"

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("")
  const [erro, setErro] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro("")

    const emailLimpo = email.trim()
    if (!emailLimpo) {
      setErro("Informe seu e-mail")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErro("Informe um e-mail válido")
      return
    }

    setLoading(true)
    try {
      await forgotPasswordRequest(emailLimpo)
      setEnviado(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível processar sua solicitação. Tente novamente."
      setErro(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background dark:from-background dark:via-background dark:to-background p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Projeto Anjos Inocentes"
              width={140}
              height={140}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Esqueci minha senha
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Informe o e-mail associado à sua conta. Se ele estiver cadastrado, enviaremos um link para redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {enviado ? (
            <div className="space-y-4">
              <Alert className="bg-success/10 border-success/30 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Se o e-mail informado estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
                  Verifique também a caixa de spam.
                </AlertDescription>
              </Alert>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {erro && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Enviando...
                  </span>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>

              <Button asChild variant="ghost" className="w-full text-muted-foreground">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
