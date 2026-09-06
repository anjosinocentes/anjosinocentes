import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.MAIL_HOST
  const port = process.env.MAIL_PORT
  const user = process.env.MAIL_USER
  const pass = process.env.MAIL_PASSWORD

  if (!host || !port || !user || !pass) {
    throw new Error(
      "Configuração de e-mail ausente. Defina MAIL_HOST, MAIL_PORT, MAIL_USER e MAIL_PASSWORD no ambiente."
    )
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  })

  return transporter
}

function passwordResetEmailHtml(params: { name: string; resetUrl: string }) {
  const { name, resetUrl } = params
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f4f4f2; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f2; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; max-width:480px; width:100%;">
          <tr>
            <td style="background-color:#F97316; padding:24px; text-align:center;">
              <span style="color:#ffffff; font-size:20px; font-weight:bold;">Projeto Anjos Inocentes</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="font-size:16px; color:#1a1a1a; margin:0 0 16px;">Olá${name ? `, ${name}` : ""}!</p>
              <p style="font-size:14px; color:#4a4a4a; line-height:1.6; margin:0 0 24px;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Sistema de Gestão do Projeto Anjos Inocentes.
                Clique no botão abaixo para criar uma nova senha.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#F97316;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">
                      Redefinir minha senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; color:#6a6a6a; line-height:1.6; margin:0 0 8px;">
                Este link é válido por <strong>15 minutos</strong> e pode ser utilizado apenas uma vez.
              </p>
              <p style="font-size:13px; color:#6a6a6a; line-height:1.6; margin:0 0 24px;">
                Caso você não tenha solicitado essa alteração, ignore este e-mail. Sua senha atual permanecerá inalterada.
              </p>
              <p style="font-size:12px; color:#9a9a9a; line-height:1.5; margin:0; word-break:break-all;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${resetUrl}" style="color:#F97316;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px; background-color:#f9f9f7; text-align:center;">
              <p style="font-size:11px; color:#a0a0a0; margin:0;">Projeto Anjos Inocentes &middot; Sistema de Gestão</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const from = process.env.MAIL_FROM || process.env.MAIL_USER
  await getTransporter().sendMail({
    from,
    to,
    subject: "Recuperação de senha - Projeto Anjos Inocentes",
    html: passwordResetEmailHtml({ name, resetUrl }),
    text:
      `Olá${name ? `, ${name}` : ""}!\n\n` +
      `Recebemos uma solicitação para redefinir a senha da sua conta.\n` +
      `Acesse o link abaixo para criar uma nova senha (válido por 15 minutos, uso único):\n\n${resetUrl}\n\n` +
      `Caso você não tenha solicitado essa alteração, ignore este e-mail.`,
  })
}
