import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { DonationForm } from "@/components/donation-form";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/crear-donacion")({
  head: () => ({
    meta: [
      { title: "Publicar donación | DonaRed" },
      {
        name: "description",
        content: "Registra alimentos o recursos disponibles para las organizaciones sociales.",
      },
      { property: "og:title", content: "Publicar donación | DonaRed" },
      {
        property: "og:description",
        content: "Formulario para publicar una nueva donación en la red.",
      },
    ],
  }),
  component: CrearDonacionPage,
});

function CrearDonacionPage() {
  const { createDonation } = useStore();
  const navigate = useNavigate();

  return (
    <AppShell
      title="Publicar donación"
      subtitle="Comparte los recursos disponibles con las organizaciones de la red"
    >
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <DonationForm
            submitLabel="Publicar donación"
            onSubmit={(input) => {
              createDonation(input);
              toast.success("Donación publicada y visible para las organizaciones");
              navigate({ to: "/mis-donaciones" });
            }}
            onCancel={() => navigate({ to: "/mis-donaciones" })}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
