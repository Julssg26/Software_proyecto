import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DonationStatus } from "@/lib/types";

const STEPS = ["Solicitud enviada", "Aprobada", "En camino", "Entregada"];

function currentStep(estado: DonationStatus) {
  switch (estado) {
    case "Disponible":
      return 0;
    case "Solicitada":
      return 1;
    case "Aprobada":
      return 2;
    case "En camino":
      return 3;
    case "Entregada":
      return 4;
    default:
      return 1;
  }
}

export function TrackingStepper({ estado }: { estado: DonationStatus }) {
  const step = currentStep(estado);
  const rechazada = estado === "Rechazada";

  return (
    <div className="w-full">
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const done = !rechazada && step > i;
          const active = !rechazada && step === i + 1;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                    rechazada
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "max-w-24 text-center text-xs",
                    done || active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 mb-6 h-0.5 flex-1 rounded-full",
                    !rechazada && step > i + 1 ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {rechazada && (
        <p className="mt-3 text-sm text-destructive">
          Esta donación fue rechazada, el flujo de entrega no continuó.
        </p>
      )}
    </div>
  );
}
