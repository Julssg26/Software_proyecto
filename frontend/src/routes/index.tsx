import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { roleHome } from "@/services/auth";
import { HandHeart, Leaf, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión | DonaRed" },
      {
        name: "description",
        content:
          "Accede a DonaRed para publicar, solicitar y dar seguimiento a donaciones de alimentos y recursos.",
      },
      { property: "og:title", content: "Iniciar sesión | DonaRed" },
      {
        property: "og:description",
        content: "Plataforma de donaciones entre empresas y organizaciones sociales.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, currentUser, hydrated } = useStore();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (hydrated && currentUser) void navigate({ to: roleHome[currentUser.rol], replace: true });
  }, [hydrated, currentUser, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const res = await login(correo, password);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "No fue posible iniciar sesión");
      return;
    }
    toast.success("Sesión iniciada");
    if (res.role) void navigate({ to: roleHome[res.role] });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="panel-grid relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <HandHeart className="size-5" />
          </div>
          <div>
            <p className="font-semibold">DonaRed</p>
            <p className="text-xs opacity-70">Donaciones con impacto</p>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl leading-tight font-semibold">
            Conectamos excedentes de empresas con quienes más los necesitan.
          </h2>
          <p className="text-sm opacity-80">
            Publica donaciones de alimentos y recursos, recibe solicitudes de organizaciones
            sociales y da seguimiento a cada entrega con total transparencia.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: Leaf, text: "Menos desperdicio, más aprovechamiento" },
              { icon: Sparkles, text: "Trazabilidad completa de cada entrega" },
              { icon: Users, text: "Empresas y organizaciones en un mismo espacio" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-sidebar-accent">
                  <f.icon className="size-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs opacity-60">Plataforma de donaciones · Ingeniería de Software</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <HandHeart className="size-5" />
            </div>
            <p className="font-semibold">DonaRed</p>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa tu correo electrónico y contraseña.
          </p>

          <Card className="mt-6 shadow-[var(--shadow-soft)]">
            <CardContent className="p-5">
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="correo">Correo electrónico</Label>
                  <Input
                    id="correo"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="tucorreo@empresa.mx"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={pending || !hydrated}>
                  {pending ? "Iniciando sesión…" : "Iniciar sesión"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link to="/registro" className="font-medium text-primary hover:underline">
                  Regístrate
                </Link>
              </p>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accede con el correo y la contraseña de tu cuenta registrada.
          </p>
        </div>
      </section>
    </div>
  );
}
