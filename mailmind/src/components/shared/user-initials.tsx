import { cn, initials } from "@/lib/utils";

/** Kleines Kürzel einer Person (z. B. Bearbeiter in Listen). */
export function UserInitials({ name, className, me }: { name: string; className?: string; me?: boolean }) {
  return (
    <span
      title={me ? `${name} (du)` : name}
      aria-label={`Zugewiesen an ${name}`}
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold",
        me ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 ring-1 ring-border",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
