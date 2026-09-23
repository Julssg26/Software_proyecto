import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { roleHome, type PublicRole } from "@/services/auth";

const ACCOUNT_TYPES: { role: PublicRole; label: string; icon: typeof HandHeart }[] = [
  { role: "empresa", label: "Empresa donante", icon: Building2 },
  { role: "organizacion", label: "Organización social", icon: HandHeart },
];

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Crear cuenta | DonaRed" },
      {
        name: "description",
        content:
          "Registra tu empresa u organización social para participar en la red de donaciones DonaRed.",
      },
      { property: "og:title", content: "Crear cuenta | DonaRed" },
      {
        property: "og:description",
        content: "Registro de empresas donantes y organizaciones sociales.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register } = useStore();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    password: "",
    rol: "empresa" as PublicRole,
    entidad: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const res = await register(form);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "No fue posible registrar la cuenta");
      return;
    }
    toast.success("Cuenta creada, bienvenida a DonaRed");
    if (res.role) void navigate({ to: roleHome[res.role] });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-lg">
        <Link to="/" className="mb-6 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <HandHeart className="size-5" />
          </span>
          <span className="font-semibold">DonaRed</span>
        </Link>

        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>
              Registra tu empresa donante u organización social para comenzar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ana Solís"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  placeholder="contacto@organizacion.mx"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label id="account-type-label">Tipo de cuenta</Label>
                <div className="grid gap-2" role="group" aria-labelledby="account-type-label">
                  {ACCOUNT_TYPES.map(({ role, label, icon: Icon }) => (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={form.rol === role}
                      onClick={() => setForm({ ...form, rol: role })}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                        form.rol === role
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="block text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
                <div className="space-y-1.5">
                  <Label htmlFor="entidad">
                    {form.rol === "empresa" ? "Nombre de la empresa" : "Nombre de la organización"}
                  </Label>
                  <Input
                    id="entidad"
                    value={form.entidad}
                    onChange={(e) => setForm({ ...form, entidad: e.target.value })}
                    placeholder={
                      form.rol === "empresa" ? "Grupo Alimentario Verde" : "Fundación Manos Unidas"
                    }
                    required
                  />
                </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creando cuenta…" : "Crear cuenta"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/" className="font-medium text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
