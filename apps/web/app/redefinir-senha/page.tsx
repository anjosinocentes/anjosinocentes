"use client"

import { useEffect, useState } from "react"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff, Check, X, ArrowLeft } from "lucide-react"
import { validateResetToken, resetPasswordRequest } from "@/lib/auth"
import { PASSWORD_REQUIREMENTS } from "@/lib/password-policy"
import { cn } from "@/lib/utils"

type PageState = "checking" | "invalid" | "expired" | "used" | "form" | "success"

function RedefinirSenhaContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [state, setState] = useState<PageState>("checking")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [erro, setErro] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setState("invalid")
      return
    }
    validateResetToken(token).then(({ valid, reason }) => {
      if (valid) {
        setState("form")
      } else if (reason === "expired") {
        setState("expired")
      } else if (reason === "used") {
        setState("used")
      } else {
        setState("invalid")
      }
    })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro("")

    const failedRequirement = PASSWORD_REQUIREMENTS.find((req) => !req.test(password))
    if (failedRequirement) {
      setErro("Sua senha ainda não atende a todos os requisitos de segurança")
      return
    }
    if (password !== confirmPassword) {
      setErro("As senhas não coincidem")
      return
    }

    setSubmitting(true)
    try {
      await resetPasswordRequest(token, password, confirmPassword)
      setState("success")
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível redefinir a senha. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background dark:from-background dark:via-background dark:to-background p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Projeto Anjos Inocentes" width={140} height={140} className="object-contain" priority />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Redefinir senha</CardTitle>
          {state === "form" && (
            <CardDescription className="text-muted-foreground">
              Crie uma nova senha para acessar sua conta
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          {state === "checking" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Spinner className="h-6 w-6" />
              <p className="text-sm">Validando link de recuperação...</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="space-y-4">
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Este link de recuperação é inválido.</AlertDescription>
              </Alert>
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <Link href="/">Voltar para o login</Link>
              </Button>
            </div>
          )}

          {state === "expired" && (
            <div className="space-y-4">
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Este link de recuperação expirou.</AlertDescription>
              </Alert>
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <Link href="/esqueci-senha">Solicitar novo link</Link>
              </Button>
            </div>
          )}

          {state === "used" && (
            <div className="space-y-4">
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Este link de recuperação já foi utilizado ou não é mais válido.</AlertDescription>
              </Alert>
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <Link href="/">Ir para o login</Link>
              </Button>
            </div>
          )}

          {state === "success" && (
            <div className="space-y-4">
              <Alert className="bg-success/10 border-success/30 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Senha alterada com sucesso!</strong> Agora você pode acessar sua conta utilizando sua nova senha.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <Link href="/">Voltar para o login</Link>
              </Button>
            </div>
          )}

          {state === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {erro && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="password">Nova senha</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua nova senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={submitting}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirmar nova senha</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={cn("text-xs flex items-center gap-1", password === confirmPassword ? "text-success" : "text-destructive")}>
                      {password === confirmPassword ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {password === confirmPassword ? "As senhas coincidem" : "As senhas não coincidem"}
                    </p>
                  )}
                </Field>
              </FieldGroup>

              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground mb-1.5">Sua senha deve conter:</p>
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const met = req.test(password)
                  return (
                    <p key={req.key} className={cn("text-xs flex items-center gap-1.5", met ? "text-success" : "text-muted-foreground")}>
                      {met ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
                      {req.label}
                    </p>
                  )
                })}
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Redefinindo...
                  </span>
                ) : (
                  "Redefinir senha"
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

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background dark:from-background dark:via-background dark:to-background p-4">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </main>
      }
    >
      <RedefinirSenhaContent />
    </Suspense>
  )
}
