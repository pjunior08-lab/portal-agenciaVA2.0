import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o portal da VA MIDIA trata os dados das contas do Facebook e do Instagram conectadas.",
};

// Dados da agência responsável (mesmos do cadastro da agência no portal).
const AGENCY = {
  name: "VA MIDIA (Vai Aonde Capixaba?)",
  cnpj: "40.338.044/0001-40",
  email: "comercial@vaiaondecapixaba.com.br",
  phone: "(27) 99951-4815",
};
const UPDATED_AT = "26 de novembro de 2026";

/** Página pública exigida pela Meta para o app de publicação. Não depende de login. */
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <Image src="/brand/simbolo-amarelo.png" alt="" width={40} height={40} className="size-10 rounded-xl" priority />
        <div>
          <p className="text-xs text-muted">Portal da agência · {AGENCY.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Política de Privacidade</h1>
        </div>
      </header>

      <main className="flex flex-col gap-6 rounded-2xl bg-surface p-6 text-sm leading-relaxed">
        <p className="text-muted">Última atualização: {UPDATED_AT}</p>

        <Section title="1. Quem somos">
          <p>
            Este portal é a ferramenta interna de gestão da {AGENCY.name}, CNPJ {AGENCY.cnpj}. Ele é usado pela equipe da agência
            para planejar, aprovar e publicar conteúdo nas redes sociais dos clientes que contrataram esse serviço. O portal não é
            aberto ao público: só entra quem foi convidado pela agência.
          </p>
        </Section>

        <Section title="2. Quais dados do Facebook e do Instagram usamos">
          <p>Quando alguém da equipe conecta a conta de um cliente pelo Login do Facebook, o portal recebe e guarda:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>o nome e o identificador das Páginas do Facebook e das contas profissionais do Instagram escolhidas;</li>
            <li>o token de acesso concedido pela Meta, que permite publicar nessas contas;</li>
            <li>o resultado de cada publicação (identificador do post, data e eventual mensagem de erro).</li>
          </ul>
          <p>
            Não coletamos dados dos seguidores, mensagens privadas, listas de amigos ou qualquer informação de pessoas que apenas
            interagem com as Páginas.
          </p>
        </Section>

        <Section title="3. Para que usamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>publicar no Facebook e no Instagram do cliente os posts que a agência preparou e que o cliente aprovou, na data agendada;</li>
            <li>mostrar à equipe quais contas estão conectadas e se cada publicação deu certo;</li>
            <li>consultar informações das contas de anúncio autorizadas pelo cliente, para acompanhar o investimento das campanhas.</li>
          </ul>
          <p>Os dados não são vendidos, cedidos nem usados para publicidade.</p>
        </Section>

        <Section title="4. Como protegemos">
          <ul className="list-disc space-y-1 pl-5">
            <li>os tokens de acesso ficam criptografados no banco de dados e nunca são enviados ao navegador;</li>
            <li>cada pessoa da equipe só vê os clientes e módulos que o administrador liberou para ela;</li>
            <li>a conexão com o portal é sempre feita por HTTPS.</li>
          </ul>
        </Section>

        <Section title="5. Com quem compartilhamos">
          <p>
            Os dados ficam em provedores de infraestrutura contratados pela agência para hospedar o portal (servidores e banco de
            dados) e são enviados à Meta apenas para realizar as publicações. Não compartilhamos com mais ninguém, exceto se a lei
            exigir.
          </p>
        </Section>

        <Section title="6. Por quanto tempo guardamos">
          <p>
            Os tokens ficam guardados enquanto a conta estiver conectada ao portal. Ao desconectar a conta, o token é apagado na
            hora. O histórico das publicações fica guardado enquanto durar o contrato com o cliente.
          </p>
        </Section>

        <Section title="7. Como pedir a exclusão dos dados" id="exclusao-de-dados">
          <p>Você pode remover o acesso do portal às suas contas a qualquer momento, de qualquer um destes jeitos:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              no Facebook, em <strong>Configurações › Integrações comerciais</strong>, remova o app <strong>Portal VA</strong>;
            </li>
            <li>pedindo à equipe da agência que desconecte a conta no portal (o token é apagado na hora);</li>
            <li>
              enviando um e-mail para <a className="text-brand-strong underline" href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>{" "}
              com o nome da Página ou do Instagram. Apagamos os dados ligados a essa conta em até 30 dias e confirmamos por e-mail.
            </li>
          </ol>
        </Section>

        <Section title="8. Seus direitos">
          <p>
            Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir acesso, correção ou exclusão dos seus dados pelo
            e-mail {AGENCY.email} ou pelo telefone {AGENCY.phone}.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
